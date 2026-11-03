import test from 'node:test';
import assert from 'node:assert/strict';
import {auditDevShipping,validateShippingAuditRequest} from './wp-shipping-audit-readonly-a2.mjs';

const principal={kind:'verified-dev-operator',readOnlyApproved:true};
const url=validateShippingAuditRequest({operation:'zones'}).expectedUrl;
const methodsUrl=validateShippingAuditRequest({operation:'methods',zoneId:0}).expectedUrl;
const zone={zoneId:0,name:'Rest of World',priority:99,regions:[]};
const method={methodId:'flat_rate',instanceId:3,enabled:true,cost:'0',
  minimum:null,requirement:null,beforeDiscount:null,classCosts:[
    {classId:1,cost:'10'},{classId:2,cost:'30'}]};
const evidence=(pageUrl=url,data={zones:[zone]})=>({
  browserVerified:true,profileVerified:true,windowVerified:true,windowPid:321,
  httpMethod:'GET',networkWrites:0,navigationPerformed:false,
  redirected:false,pageUrl,data,html:'<input name="nonce" value="SECRET"/>',
  cookies:'session=SUPERSECRET',headers:{authorization:'TOPSECRET'}
});
const props={principal,windowPid:321,lock:async callback=>callback(),
  readPage:async ()=>evidence()};
const invoke=(input,overrides={})=>auditDevShipping(input,{...props,...overrides});
const deny = async (input,overrides={},code)=>{
  let called=false;
  const out=await invoke(input,{readPage:async ()=>{called=true;return evidence();},...overrides});
  assert.equal(out.ok,false);
  if(code)assert.equal(out.errorCode,code);
  if(code==='UNEXPECTED_FIELDS'||code==='OPERATION_DENIED'||code==='INVALID_ZONE_ID')assert.equal(called,false);
};
test('typed zones request constructs fixed https Dev URL',()=>{
  assert.equal(url,'https://dev.beyourlover.com/wp-admin/admin.php?page=wc-settings&tab=shipping');
  assert.equal(methodsUrl,url+'&zone_id=0');
});
test('single schema-only zone read; no raw data leaks',async()=>{
  const res=await invoke({operation:'zones'});
  assert.equal(res.ok,true);
  assert.equal(res.environment,'DEV');
  assert.deepEqual(res.zones,[zone]);
  for(const v of ['SECRET','SUPERSECRET','TOPSECRET','html','cookies','headers'])
    assert.ok(!JSON.stringify(res).includes(v));
});
test('methods preserve $0 flat rate as flat rate (not free shipping)',async()=>{
  const res=await invoke({operation:'methods',zoneId:0},{
    readPage:async()=>evidence(methodsUrl,{zoneId:0,methods:[method]})});
  assert.equal(res.ok,true);
  assert.equal(res.methods[0].cost,'0');
  assert.equal(res.methods[0].methodId,'flat_rate');
  assert.equal(res.methods[0].classCosts[1].cost,'30');
  assert.ok(!Object.hasOwn(res,'freeShipping'));
});
test('known free shipping requirement is reported without inventing post-discount truth',async()=>{
  const free={...method,methodId:'free_shipping',instanceId:9,cost:null,
    minimum:'69.00',requirement:'min_amount',beforeDiscount:true,classCosts:[]};
  const res=await invoke({operation:'methods',zoneId:0},{
    readPage:async()=>evidence(methodsUrl,{zoneId:0,methods:[free]})});
  assert.equal(res.ok,true);assert.equal(res.methods[0].beforeDiscount,true);
  assert.equal(res.methods[0].minimum,'69.00');
});
test('reject arbitrary URL, WWW, action, payload and prohibited methods before adapter',async()=>{
  for(const p of [
    {operation:'zones',url:'https://www.beyourlover.com/wp-admin/'},
    {operation:'zones',host:'www.beyourlover.com'},
    {operation:'zones',method:'POST'},
    {operation:'zones',action:'save'},
    {operation:'zones',javascript:'alert(1)'},
    {operation:'methods',zoneId:0,nonce:'abc'},
    {operation:'delete'}, {operation:'zones',zoneId:1}
  ])await deny(p,{},p.operation==='delete'?'OPERATION_DENIED':'UNEXPECTED_FIELDS');
  await deny({operation:'methods',zoneId:-1},{},'INVALID_ZONE_ID');
  await deny({operation:'methods',zoneId:'0'},{},'INVALID_ZONE_ID');
  await deny({}, {}, 'OPERATION_DENIED');
});
test('operator approval required and reader never called if unapproved',async()=>{
  let called=false;
  const out=await invoke({operation:'zones'},{principal:{kind:'anonymous',readOnlyApproved:true},
    readPage:async()=>{called=true;return evidence();}});
  assert.equal(out.errorCode,'OPERATOR_DENIED');assert.equal(called,false);
  await deny({operation:'zones'},{principal:null},'OPERATOR_DENIED');
  await deny({operation:'zones'},{windowPid:0},'WINDOW_PID_REQUIRED');
  await deny({operation:'zones'},{lock:undefined},'ADAPTER_UNAVAILABLE');
});
test('reject wrong host, redirects, wrong PID, cookie credential in URL',async()=>{
  const invalid=[
    'https://www.beyourlover.com/wp-admin/admin.php?page=wc-settings&tab=shipping',
    'https://dev.beyourlover.com.evil.test/wp-admin/admin.php?page=wc-settings&tab=shipping',
    'https://user:secret@dev.beyourlover.com/wp-admin/admin.php?page=wc-settings&tab=shipping',
    'https://dev.beyourlover.com/wp-admin/admin.php?page=wc-settings&tab=shipping&action=save',
    'http://dev.beyourlover.com/wp-admin/admin.php?page=wc-settings&tab=shipping',
    'https://dev.beyourlover.com/wp-login.php'
  ];
  for(const target of invalid)await deny({operation:'zones'},
    {readPage:async()=>evidence(target)},'SOURCE_NOT_VERIFIED');
  for(const fields of [
    {windowPid:123}, {browserVerified:false},{profileVerified:false},
    {windowVerified:false},{httpMethod:'POST'},{networkWrites:1},
    {navigationPerformed:true},{redirected:true}
  ])await deny({operation:'zones'},
    {readPage:async()=>({...evidence(),...fields})},'SOURCE_NOT_VERIFIED');
});
test('reject unsafe extracted data and duplicates without partial output',async()=>{
  const variants=[
    {zones:[zone,zone]},
    {zones:[{...zone,name:'<script>steal()</script>'}]},
    {zones:[{...zone,regions:[{type:'country',code:'US;DROP'}]}]},
    {zones:[{...zone,priority:-1}]},
    {zones:[{...zone,regions:new Array(301).fill({type:'country',code:'US'})}]},
    {zones:new Array(101).fill(zone)},
    {zones:'not an array'}
  ];
  for(const data of variants)await deny({operation:'zones'},
    {readPage:async()=>evidence(url,data)},'UNTRUSTED_DATA_DENIED');
});
test('reject unsafe method data, currency formats and duplicate instances',async()=>{
  const variants=[
    {zoneId:1,methods:[method]},
    {zoneId:0,methods:[method,method]},
    {zoneId:0,methods:[{...method,cost:'20;curl evil.test'}]},
    {zoneId:0,methods:[{...method,minimum:'USD 69'}]},
    {zoneId:0,methods:[{...method,beforeDiscount:'false'}]},
    {zoneId:0,methods:[{...method,methodId:'dangerous_method'}]},
    {zoneId:0,methods:[{...method,classCosts:[{classId:1,cost:'<script>'}]}]}
  ];
  for(const data of variants)await deny({operation:'methods',zoneId:0},
    {readPage:async()=>evidence(methodsUrl,data)},'UNTRUSTED_DATA_DENIED');
});
test('a locked or failed inspection fails closed with no exception details',async()=>{
  assert.equal((await invoke({operation:'zones'},{lock:async()=>{throw Object.assign(Error('busy'),{code:'INSPECTION_LOCKED'})}})).errorCode,'INSPECTION_LOCKED');
  const failed=await invoke({operation:'zones'},{readPage:async()=>{throw Error('secret token abc')}});
  assert.equal(failed.errorCode,'INSPECTION_FAILED_CLOSED');
  assert.ok(!JSON.stringify(failed).includes('secret'));
  assert.equal((await invoke({operation:'zones'},{lock:async()=>null})).errorCode,'LOCK_RESULT_INVALID');
});
