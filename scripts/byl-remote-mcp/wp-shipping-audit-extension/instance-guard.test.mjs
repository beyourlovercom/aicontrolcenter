import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  fixedInstanceBatchRequest,exactInstancePage,sanitizeInstanceDetail,
  aggregateInstanceBatch,safeBatchFilename,INSTANCE_DETAILS_SCHEMA
} from './instance-guard.mjs';
import {readWooShippingInstanceDocument} from './instance-snapshot.mjs';

const dev=fixedInstanceBatchRequest({environment:'DEV',operation:'instanceBatch'});
const www=fixedInstanceBatchRequest({environment:'WWW',operation:'instanceBatch'});
const free=www.targets.find(x=>x.instanceId===1);
const flat=www.targets.find(x=>x.instanceId===3);
const input=(key,value,kind,type='text')=>{
  const id='woocommerce_'+kind+'_'+key;
  return {id,name:id,tagName:'INPUT',type,value:String(value)};
};
const select=(key,value,kind)=>{
  const id='woocommerce_'+kind+'_'+key;
  return {id,name:id,tagName:'SELECT',type:'select-one',value};
};
const withMockPage=(target,fields,callback,classRows=[])=>{
  const oldDoc=globalThis.document,oldLoc=globalThis.location;
  globalThis.location={href:target.url};
  globalThis.document={
    getElementById(key){return fields[key]??null;},
    querySelectorAll(selector){
      return selector==='input[id^="woocommerce_flat_rate_class_cost_"]'?classRows:[];
    }
  };
  try{return callback();}finally{
    globalThis.document=oldDoc;globalThis.location=oldLoc;
  }
};
const fields=(kind,values={})=>Object.fromEntries(
  Object.entries(values).map(([k,v])=>{
    const control=k==='requires'||k==='type'?select(k,v,kind):
      k==='ignore_discounts'
        ?{...input(k,'yes',kind,'checkbox'),checked:v===true}
        :input(k,v,kind);
    return [control.id,control];
  })
);
const freeSnapshot=target=>({
  schema:'wp_shipping_instance_dom.v1',pageUrl:target.url,
  kind:target.kind,instanceId:target.instanceId,uiVerified:true,
  requires:'min_amount',minimum:'69.00',ignoreDiscounts:false,
  nonce:'super-secret',customer:'person@example.com'
});
const flatSnapshot=target=>({
  schema:'wp_shipping_instance_dom.v1',pageUrl:target.url,
  kind:target.kind,instanceId:target.instanceId,uiVerified:true,
  cost:'0',noClassCost:'',calculationType:'class',
  classCosts:[{classId:11,cost:'30'}],
  nonce:'super-secret',cookie:'wordpress_logged_in=SECRET'
});
test('exact nine WWW-observed method instance IDs, type, zone mapping, URLs',()=>{
  assert.equal(www.ok,true);assert.equal(dev.ok,true);
  const matrix=www.targets.map(x=>[x.zoneId,x.instanceId,x.kind]);
  assert.deepEqual(matrix,[
    [0,1,'free_shipping'],[0,3,'flat_rate'],
    [5,9,'free_shipping'],[5,10,'flat_rate'],
    [4,7,'flat_rate'],[4,8,'free_shipping'],
    [3,5,'flat_rate'],[3,6,'free_shipping'],
    [1,2,'free_shipping']
  ]);
  assert.equal(new Set(www.targets.map(x=>x.instanceId)).size,9);
  assert.equal(www.targets[0].url,
    'https://www.beyourlover.com/wp-admin/admin.php?page=wc-settings&tab=shipping&instance_id=1');
  assert.ok(dev.targets.every(x=>x.url.startsWith('https://dev.beyourlover.com/')));
});
test('fails closed for arbitrary caller URL/ID/query and hostname',()=>{
  for(const obj of [
    {environment:'WWW',operation:'instanceBatch',url:'https://evil.test/'},
    {environment:'WWW',operation:'instanceBatch',instanceId:11},
    {environment:'DEV',operation:'instanceBatch',zoneId:0},
    {environment:'WWW',operation:'instanceBatch',method:'POST'},
    {environment:'WWW',operation:'instance'},
    {environment:'www.beyourlover.com',operation:'instanceBatch'},
    {environment:'__proto__',operation:'instanceBatch'},
    {environment:'WWW',operation:'instanceBatch',scripts:['javascript:alert(1)']}
  ])assert.equal(fixedInstanceBatchRequest(obj).ok,false);
  for(const u of [
    free.url.replace('https://','http://'),
    free.url.replace('instance_id=1','instance_id=3'),
    free.url+'&action=save',
    free.url.replace('www.beyourlover.com','www.beyourlover.com.evil.test'),
    free.url.replace('www.beyourlover.com','user:secret@www.beyourlover.com'),
    free.url+'#edit'
  ])assert.equal(exactInstancePage(u,free),false);
  assert.equal(exactInstancePage(free.url,free),true);
});
test('free settings extract min, coupon requirement and after-discount flag',()=>{
  const item=withMockPage(free,fields('free_shipping',{
    requires:'min_amount',min_amount:'69.00',ignore_discounts:false
  }),()=>readWooShippingInstanceDocument(free.url,1,'free_shipping'));
  const out=sanitizeInstanceDetail(item,free);
  assert.equal(out.ok,true);assert.equal(out.requires,'min_amount');
  assert.equal(out.minAmount,'69.00');assert.equal(out.ignoreDiscounts,false);
  assert.equal(out.partial,false);
  assert.equal(out.priorZoneId,0);
  assert.ok(!JSON.stringify(out).includes('nonce'));
  const before={...freeSnapshot(free),ignoreDiscounts:true,requires:'both'};
  assert.equal(sanitizeInstanceDetail(before,free).ignoreDiscounts,true);
  assert.equal(sanitizeInstanceDetail(before,free).requires,'both');
});
test('no requirement and blank threshold are distinguishable from unknown',()=>{
  const item=withMockPage(free,fields('free_shipping',{
    requires:'',min_amount:'',ignore_discounts:true
  }),()=>readWooShippingInstanceDocument(free.url,1,'free_shipping'));
  const out=sanitizeInstanceDetail(item,free);
  assert.equal(out.ok,true);assert.equal(out.requires,'');
  assert.equal(out.minAmount,'');assert.equal(out.ignoreDiscounts,true);
});
test('flat cost zero, blank no-class, numeric class fees, per class/order',()=>{
  const row=flatSnapshot(flat);
  const out=sanitizeInstanceDetail(row,flat);
  assert.equal(out.ok,true);assert.equal(out.cost,'0');
  assert.equal(out.noClassCost,'');assert.equal(out.classCosts[0].cost,'30');
  assert.equal(out.calculationType,'class');
  assert.ok(!JSON.stringify(out).includes('wordpress_logged_in'));
  const form=fields('flat_rate',{cost:'0',no_class_cost:'10',type:'order'});
  const classRow=input('class_cost_11','30','flat_rate');
  const result=withMockPage(flat,form,()=>readWooShippingInstanceDocument(flat.url,3,'flat_rate'),[classRow]);
  const parsed=sanitizeInstanceDetail(result,flat);
  assert.equal(parsed.ok,true);assert.equal(parsed.cost,'0');
  assert.equal(parsed.noClassCost,'10');assert.equal(parsed.calculationType,'order');
  assert.deepEqual(parsed.classCosts,[{classId:11,cost:'30'}]);
});
test('unrecognized fees/forms are not serialized, partial is truthful',()=>{
  const form=fields('flat_rate',{cost:'[fee percent="3"]',no_class_cost:'internal_note',type:'class'});
  const result=withMockPage(flat,form,
    ()=>readWooShippingInstanceDocument(flat.url,3,'flat_rate'));
  const clean=sanitizeInstanceDetail(result,flat);
  assert.equal(clean.ok,true);assert.equal(clean.cost,null);
  assert.equal(clean.noClassCost,null);assert.equal(clean.partial,true);
  assert.ok(!JSON.stringify(clean).includes('internal_note'));
  const missing=withMockPage(flat,{},()=>readWooShippingInstanceDocument(flat.url,3,'flat_rate'));
  assert.equal(sanitizeInstanceDetail(missing,flat).ok,false);
});
test('malicious cross-account pages and mismatched controls are denied',()=>{
  const invalid=[
    {...freeSnapshot(free),pageUrl:'https://www.beyourlover.com/wp-admin/admin.php?page=wc-orders'},
    {...freeSnapshot(free),kind:'flat_rate'},
    {...freeSnapshot(free),instanceId:999},
    {...freeSnapshot(free),requires:'<script>hello</script>'},
    {...freeSnapshot(free),minimum:'GBP 69'},
    {...freeSnapshot(free),ignoreDiscounts:'true'},
    {...freeSnapshot(free),uiVerified:false},
    {...freeSnapshot(free),pageUrl:free.url+'&_wpnonce=secret'}
  ];
  for(const snapshot of invalid)assert.equal(sanitizeInstanceDetail(snapshot,free).ok,false);
  const spoofed=withMockPage({...free,url:free.url.replace('www.','dev.')},
    fields('free_shipping',{requires:'min_amount',min_amount:'69',ignore_discounts:false}),
    ()=>readWooShippingInstanceDocument(free.url,1,'free_shipping'));
  assert.equal(sanitizeInstanceDetail(spoofed,free).ok,false);
});
test('rejects fake shipping classes, duplicate IDs and arbitrary string content',()=>{
  for(const classCosts of [
    [{classId:11,cost:'admin_token'}],
    [{classId:11,cost:'10'}, {classId:11,cost:'20'}],
    [{classId:0,cost:'30'}],
    [{classId:1,cost:'-20'}],
    [{classId:2,cost:'[qty]'}]
  ])assert.equal(sanitizeInstanceDetail({...flatSnapshot(flat),classCosts},flat).ok,false);
  assert.equal(sanitizeInstanceDetail({...flatSnapshot(flat),calculationType:'x'},flat).ok,false);
});
test('batch aggregation requires exactly nine sanitized, typed, ordered sources',()=>{
  const rows=www.targets.map(target=>sanitizeInstanceDetail(
    target.kind==='flat_rate'?flatSnapshot(target):freeSnapshot(target),target));
  assert.ok(rows.every(row=>row.ok));
  const complete=aggregateInstanceBatch(www,rows,'2026-10-21T03:00:00.000Z');
  assert.equal(complete.ok,true);assert.equal(complete.schema,INSTANCE_DETAILS_SCHEMA);
  assert.equal(complete.count,9);assert.equal(complete.partial,false);
  assert.equal(aggregateInstanceBatch(www,rows.slice(1),'2026-10-21').ok,false);
  assert.equal(aggregateInstanceBatch(www,rows.toReversed(),'2026-10-21').ok,false);
  rows[0]={...rows[0],partial:true};
  assert.equal(aggregateInstanceBatch(www,rows,'2026-10-21').partial,true);
});
test('download filename stable, no arbitrary path injection',()=>{
  const name=safeBatchFilename(www,new Date('2026-10-21T03:00:00.000Z'));
  assert.equal(name,'BYL-shipping-readonly-WWW-instances-9-2026-10-21T03-00-00-000Z.json');
  assert.equal(safeBatchFilename(www,new Date('invalid')),null);
});
test('extension remains same host-permission scope and is not registered as generic browser control',()=>{
  const manifest=JSON.parse(readFileSync(new URL('./manifest.json',import.meta.url),'utf8'));
  const html=readFileSync(new URL('./popup.html',import.meta.url),'utf8');
  assert.deepEqual(manifest.optional_host_permissions,
    ['https://dev.beyourlover.com/*','https://www.beyourlover.com/*']);
  assert.equal(manifest.host_permissions,undefined);
  assert.ok(!manifest.permissions.includes('cookies'));
  assert.ok(html.includes('instanceBatch'));
});
