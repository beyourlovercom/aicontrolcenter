import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixedShippingRequest,exactAuditPage,sanitizeBrowserSnapshot,
  safeExportName,AUDIT_SCHEMA} from './guard.mjs';
import {readWooShippingDocument} from './snapshot.mjs';

const dev=fixedShippingRequest({environment:'DEV',operation:'zones'});
const prod=fixedShippingRequest({environment:'WWW',operation:'zones'});
const methods=fixedShippingRequest({environment:'DEV',operation:'methods',zoneId:5});
const validZone={zoneId:0,name:'Rest of World',priority:6,
  regionDisplay:'Locations not covered by your other zones'};
const snapshot=(req,rows,warnings=[],partial=false)=>({
  schema:'wp_shipping_dom.v1',pageUrl:req.url,operation:req.operation,
  rows,warnings,partial
});
test('Dev & WWW exact targets are distinct, HTTPS and read-only Woo pages',()=>{
  assert.equal(dev.ok,true);assert.equal(prod.ok,true);
  assert.equal(dev.url,'https://dev.beyourlover.com/wp-admin/admin.php?page=wc-settings&tab=shipping');
  assert.equal(prod.url,'https://www.beyourlover.com/wp-admin/admin.php?page=wc-settings&tab=shipping');
  assert.equal(methods.url,'https://dev.beyourlover.com/wp-admin/admin.php?page=wc-settings&tab=shipping&zone_id=5');
  assert.ok(!dev.url.includes('nonce='));
  assert.equal(exactAuditPage(dev.url,dev),true);
  assert.equal(exactAuditPage(prod.url,dev),false);
});
test('denies arbitrary URL, hostname, scripts, action, userinfo and zone tricks',()=>{
  for(const req of [
    {environment:'DEV',operation:'zones',url:'https://evil.test'},
    {environment:'DEV',operation:'zones',action:'save'},
    {environment:'WWW',operation:'zones',script:'evil()'},
    {environment:'DEV',operation:'zones',zoneId:0},
    {environment:'WWW',operation:'methods'},
    {environment:'WWW',operation:'methods',zoneId:-1},
    {environment:'WWW',operation:'methods',zoneId:'0'},
    {environment:'PRODUCTION',operation:'zones'},
    {environment:'DEV',operation:'delete'}
  ])assert.equal(fixedShippingRequest(req).ok,false);
  for(const href of [
    'https://www.beyourlover.com/wp-admin/admin.php?page=wc-settings&tab=shipping',
    dev.url+'&action=delete',dev.url+'&zone_id=0',
    'http://dev.beyourlover.com/wp-admin/admin.php?page=wc-settings&tab=shipping',
    'https://a:b@dev.beyourlover.com/wp-admin/admin.php?page=wc-settings&tab=shipping',
    'https://dev.beyourlover.com.evil.test/wp-admin/admin.php?page=wc-settings&tab=shipping',
    'https://dev.beyourlover.com/wp-login.php'
  ])assert.equal(exactAuditPage(href,dev),false);
});
test('zones export only allowlisted fields, dropping untrusted WordPress secrets',()=>{
  const injected={...validZone,
    nonce:'secret-token',userEmail:'customer@example.com',
    cookie:'wordpress_logged_in=secret',html:'<script>alert(1)</script>'};
  const result=sanitizeBrowserSnapshot(snapshot(dev,[injected]),dev);
  assert.equal(result.ok,true);assert.equal(result.schema,AUDIT_SCHEMA);
  assert.deepEqual(result.rows,[validZone]);assert.equal(result.partial,false);
  for(const secret of ['secret-token','customer@example.com','wordpress_logged_in','<script>'])
    assert.ok(!JSON.stringify(result).includes(secret));
});
test('cost 0 belongs to Flat rate; cannot be inferred as Free Shipping',()=>{
  const row={instanceId:10,methodId:'flat_rate',label:'Flat rate',
    cost:'0',minimum:null,enabled:true,
    nonce:'secret-other'};
  const result=sanitizeBrowserSnapshot(snapshot(methods,[row]),methods);
  assert.equal(result.ok,true);assert.equal(result.partial,false);
  assert.equal(result.rows[0].cost,'0');assert.equal(result.rows[0].methodId,'flat_rate');
  assert.ok(!JSON.stringify(result).includes('nonce'));
  const free=sanitizeBrowserSnapshot(snapshot(methods,[
    {...row,instanceId:11,methodId:'free_shipping',cost:null,minimum:'69.00'}
  ],['MISSING_COST'],true),methods);
  assert.equal(free.ok,true);assert.equal(free.partial,true);
  assert.equal(free.rows[0].minimum,'69.00');
});
test('unknown markup and invisible costs are partial, never zero defaults',()=>{
  const zone=sanitizeBrowserSnapshot(snapshot(dev,[
    {zoneId:5,name:'United States',regionDisplay:null,priority:null}
  ],['MISSING_PRIORITY'],true),dev);
  assert.equal(zone.ok,true);assert.equal(zone.partial,true);
  assert.equal(zone.rows[0].priority,null);
  const fee=sanitizeBrowserSnapshot(snapshot(methods,[
    {instanceId:10,methodId:'flat_rate',label:'Flat rate',cost:null,minimum:null,enabled:null}
  ],['MISSING_COST'],true),methods);
  assert.equal(fee.ok,true);assert.equal(fee.rows[0].cost,null);
  assert.equal(fee.partial,true);
});
test('rejects untrusted data, markup injection and duplicate IDs',()=>{
  const rejected=[
    snapshot(dev,[{...validZone,name:'<script>send()</script>'}]),
    snapshot(dev,[{...validZone,regionDisplay:'customer\nemail'}]),
    snapshot(dev,[validZone,validZone]),
    snapshot(dev,[{...validZone,priority:-1}]),
    snapshot(dev,new Array(101).fill(validZone)),
    {...snapshot(dev,[]),pageUrl:prod.url},
    {...snapshot(dev,[]),warnings:['SECRET_VALUE']},
    {...snapshot(dev,[]),operation:'methods'},
    {...snapshot(dev,[]),schema:'malicious'}
  ];
  for(const raw of rejected)assert.equal(sanitizeBrowserSnapshot(raw,dev).ok,false);
});
test('local JSON export filename uses fixed environment, no external paths',()=>{
  const filename=safeExportName(methods,new Date('2026-10-20T03:30:00.000Z'));
  assert.equal(filename,'BYL-shipping-readonly-DEV-methods-zone5-2026-10-20T03-30-00-000Z.json');
  assert.equal(safeExportName(dev,new Date('invalid')),null);
});
const fakeElement=(text='',props={})=>({textContent:text,...props});
const fakeRow=(attributes,selectors)=>{
  const row={
    getAttribute(name){return Object.prototype.hasOwnProperty.call(attributes,name)?attributes[name]:null;},
    querySelector(selector){return selectors[selector]??null;}
  };
  return row;
};
async function withMockPage(pageUrl,tableRows,operation,callback,footerRows=[]){
  const oldDoc=globalThis.document,oldLoc=globalThis.location;
  const zoneSelector='table.wc-shipping-zones tbody tr';
  const methodSelector='table.wc-shipping-zone-methods tbody tr';
  const footerSelector='table.wc-shipping-zones tfoot.wc-shipping-zone-worldwide[data-id="0"]';
  globalThis.location={href:pageUrl};
  globalThis.document={querySelectorAll(selector){
    if(selector===footerSelector)return footerRows;
    return selector===(operation==='zones'?zoneSelector:methodSelector)?tableRows:[];
  }};
  try{return await callback();}
  finally{globalThis.document=oldDoc;globalThis.location=oldLoc;}
}
test('real document parser reads only Woo zone table columns and no hidden tokens',async()=>{
  const row=fakeRow({'data-id':'0','data-priority':'6'},{
    'td.wc-shipping-zone-name a':fakeElement('Rest of World'),
    'td.wc-shipping-zone-region':fakeElement('Locations not covered by your other zones')
  });
  const parsed=await withMockPage(dev.url,[row],'zones',()=>readWooShippingDocument(dev.url,'zones'));
  const output=sanitizeBrowserSnapshot(parsed,dev);
  assert.equal(output.ok,true);assert.equal(output.partial,false);
  assert.deepEqual(output.rows,[validZone]);
});
test('parser does not make up method cost if it is not on the visible page',async()=>{
  const row=fakeRow({'data-id':'10','data-method-id':'flat_rate'},{
    'td.wc-shipping-zone-method-title a':fakeElement('Flat rate')
  });
  const parsed=await withMockPage(methods.url,[row],'methods',()=>readWooShippingDocument(methods.url,'methods'));
  const output=sanitizeBrowserSnapshot(parsed,methods);
  assert.equal(output.ok,true);
  assert.equal(output.rows[0].cost,null);
  assert.equal(output.partial,true);
  assert.ok(output.warnings.includes('MISSING_COST'));
});
test('parser rejects non-shipping and spoofed WWW page without reading DOM',async()=>{
  const parsed=await withMockPage('https://www.beyourlover.com/wp-admin/admin.php?page=wc-orders',[],
    'zones',()=>readWooShippingDocument(dev.url,'zones'));
  assert.equal(sanitizeBrowserSnapshot(parsed,dev).ok,false);
});
test('manifest + popup source enforce explicit host permission, scoped DNR before GET',()=>{
  const root=new URL('.',import.meta.url);
  const manifest=JSON.parse(readFileSync(new URL('manifest.json',root),'utf8'));
  const popup=readFileSync(new URL('popup.mjs',root),'utf8');
  const worker=readFileSync(new URL('background.mjs',root),'utf8');
  assert.equal(manifest.manifest_version,3);
  assert.equal(manifest.background.service_worker,'background.mjs');
  assert.ok(manifest.optional_host_permissions.includes('https://dev.beyourlover.com/*'));
  assert.ok(manifest.optional_host_permissions.includes('https://www.beyourlover.com/*'));
  assert.equal(manifest.host_permissions,undefined);
  assert.ok(!manifest.permissions.includes('cookies'));
  assert.ok(!manifest.permissions.includes('webRequest'));
  assert.ok(!manifest.permissions.includes('tabs'));
  assert.ok(popup.includes('chrome.permissions.request'));
  assert.ok(popup.includes('chrome.runtime.sendMessage'));
  for(const token of [
    'chrome.permissions.contains','chrome.declarativeNetRequest.updateSessionRules',
    'chrome.tabs.create','chrome.tabs.update','chrome.scripting.executeScript',
    'chrome.downloads.download','chrome.downloads.search', 'removeRuleIds',
    'chrome.storage.session', 'cleanupOrphan'
  ])assert.ok(worker.includes(token),token);
  assert.ok(worker.indexOf('addRules:[rule]')<worker.indexOf('chrome.tabs.update'));
  const transactionWorker=worker.slice(worker.indexOf('async function readAndExport'));
  assert.ok(transactionWorker.indexOf('chrome.tabs.remove(tab.id)')<transactionWorker.indexOf('removeRuleIds'));
  assert.ok(worker.includes("'main_frame'"));
  assert.ok(!worker.includes('fetch('));
  assert.ok(!worker.includes('forms.submit'));
});


test('Woo template worldwide footer is included even though outside tbody',async()=>{
  const regular=fakeRow({'data-id':'5','data-priority':'1'},{
    'td.wc-shipping-zone-name':fakeElement('United States'),
    'td.wc-shipping-zone-region':fakeElement('United States (US)')
  });
  const worldwide=fakeRow({'data-id':'0'},{
    'td.wc-shipping-zone-name':fakeElement('Rest of the world'),
    'td.wc-shipping-zone-region':fakeElement('Any unmatched shipping destination')
  });
  const parsed=await withMockPage(dev.url,[regular],'zones',
    ()=>readWooShippingDocument(dev.url,'zones'),[worldwide]);
  const result=sanitizeBrowserSnapshot(parsed,dev);
  assert.equal(result.ok,true);
  assert.deepEqual(result.rows.map(r=>r.zoneId),[5,0]);
  assert.equal(result.rows[1].name,'Rest of the world');
  assert.equal(result.rows[1].priority,null);
  assert.equal(result.partial,true);
});
test('Woo methods data-enabled attribute maps yes/no without clicking status link',async()=>{
  const on=fakeRow({'data-id':'10','data-enabled':'yes'},{
    'td.wc-shipping-zone-method-title':fakeElement('Flat rate')
  });
  const off=fakeRow({'data-id':'11','data-enabled':'no'},{
    'td.wc-shipping-zone-method-title':fakeElement('Local pickup')
  });
  const parsed=await withMockPage(methods.url,[on,off],'methods',
    ()=>readWooShippingDocument(methods.url,'methods'));
  const result=sanitizeBrowserSnapshot(parsed,methods);
  assert.equal(result.ok,true);
  assert.deepEqual(result.rows.map(r=>r.enabled),[true,false]);
  assert.equal(result.partial,true);
});


test('shipping rates cannot export alphabetic secrets disguised as cost',()=>{
  for(const maliciousCost of ['admin_token','internal_note','[fee percent=99]','20;secret']){
    const result=sanitizeBrowserSnapshot(snapshot(methods,[{
      instanceId:14,methodId:'flat_rate',label:'Flat rate',
      cost:maliciousCost,minimum:null,enabled:true
    }]),methods);
    assert.equal(result.ok,false,maliciousCost);
  }
});
