/**
 * Issue #101 A2: source-only, synthetic/Dev shipping audit adapter contract.
 * NOT registered in OAuth MCP. NO browser driver, navigation, shell or WWW access.
 * A future browser adapter must independently prove its operator/profile/origin.
 */
const DEV_HOST = 'dev.beyourlover.com';
const BASE = 'https://' + DEV_HOST + '/wp-admin/admin.php';
const NAME_RE = /^[\p{L}\p{N} ._()\/-]{1,100}$/u;
const RATE_RE = /^[0-9a-z_\[\] +*().-]{1,80}$/i;
const TYPES = new Set(['country', 'state', 'postcode', 'continent']);
const METHODS = new Set(['flat_rate', 'free_shipping', 'local_pickup']);
const REQUIREMENTS = new Set(['min_amount', 'coupon', 'either', 'both']);
const CODES = new Set(['ZONES_UNAVAILABLE', 'METHODS_UNAVAILABLE', 'SOURCE_NOT_VERIFIED',
  'INSPECTION_TIMEOUT', 'INSPECTION_LOCKED']);
const fail = errorCode => Object.freeze({ok:false,errorCode,executed:false});
const own = (object, key) => Object.prototype.hasOwnProperty.call(object,key);
const integer = (n, max=1000000) => Number.isSafeInteger(n) && n>=0 && n<=max;
const cleanName = s => typeof s==='string' && NAME_RE.test(s) ? s : null;
const rateText = s => typeof s==='string' && RATE_RE.test(s) ? s : null;
const obj = s => s!==null && typeof s==='object' && !Array.isArray(s);

export function validateShippingAuditRequest(input) {
  if(!obj(input))return fail('INVALID_REQUEST');
  if(Object.keys(input).some(k=>!['operation','zoneId'].includes(k)))return fail('UNEXPECTED_FIELDS');
  if(input.operation!=='zones' && input.operation!=='methods')return fail('OPERATION_DENIED');
  if(input.operation==='zones' && own(input,'zoneId'))return fail('UNEXPECTED_FIELDS');
  if(input.operation==='methods' && !integer(input.zoneId,99999))return fail('INVALID_ZONE_ID');
  const url=new URL(BASE);
  url.searchParams.set('page','wc-settings');
  url.searchParams.set('tab','shipping');
  if(input.operation==='methods')url.searchParams.set('zone_id',String(input.zoneId));
  return Object.freeze({ok:true,operation:input.operation,
    zoneId:input.operation==='methods'?input.zoneId:null,
    expectedUrl:url.toString(),method:'GET',host:DEV_HOST});
}
function checkEvidence(snapshot,expected,windowPid) {
  if(!obj(snapshot)||snapshot.browserVerified!==true||snapshot.profileVerified!==true||
    snapshot.windowVerified!==true||snapshot.windowPid!==windowPid||
    snapshot.httpMethod!=='GET'||snapshot.networkWrites!==0||
    snapshot.navigationPerformed!==false)return false;
  try{
    const u=new URL(snapshot.pageUrl);
    return u.toString()===expected && u.protocol==='https:' &&
      u.hostname===DEV_HOST && u.username==='' && u.password==='' &&
      snapshot.redirected!==true;
  }catch{return false;}
}
function normalizeZone(row) {
  if(!obj(row)||!integer(row.zoneId,99999)||!cleanName(row.name)||
    !integer(row.priority,99999)||!Array.isArray(row.regions)||
    row.regions.length>300)return null;
  const regions=[];
  for(const region of row.regions){
    if(!obj(region)||!TYPES.has(region.type)||
      typeof region.code!=='string'||!(/^[A-Z0-9*-]{1,24}$/).test(region.code))
      return null;
    regions.push({type:region.type,code:region.code});
  }
  return {zoneId:row.zoneId,name:row.name,priority:row.priority,regions};
}
function normalizeMethod(row) {
  if(!obj(row)||!METHODS.has(row.methodId)||!integer(row.instanceId,9999999)||
    typeof row.enabled!=='boolean')return null;
  const cost=row.cost===null?null:rateText(row.cost);
  const minimum=row.minimum===null?null:
    (typeof row.minimum==='string' && /^\d{1,8}(?:\.\d{1,2})?$/.test(row.minimum)?row.minimum:null);
  if((row.cost!==null && cost===null)||(row.minimum!==null && minimum===null))return null;
  const requirement=row.requirement===null?null:row.requirement;
  if(requirement!==null&&!REQUIREMENTS.has(requirement))return null;
  const beforeDiscount=row.beforeDiscount===null?null:row.beforeDiscount;
  if(beforeDiscount!==null&&typeof beforeDiscount!=='boolean')return null;
  if(!Array.isArray(row.classCosts)||row.classCosts.length>40)return null;
  const classCosts=[];
  for(const item of row.classCosts){
    if(!obj(item)||!integer(item.classId,9999999))return null;
    const value=item.cost===null?null:rateText(item.cost);
    if(item.cost!==null&&value===null)return null;
    classCosts.push({classId:item.classId,cost:value});
  }
  return {methodId:row.methodId,instanceId:row.instanceId,enabled:row.enabled,
    cost,minimum,requirement,beforeDiscount,classCosts};
}
function normalizeRows(operation,data,zoneId) {
  if(!obj(data))return null;
  if(operation==='zones'){
    if(!Array.isArray(data.zones)||data.zones.length>100)return null;
    const rows=data.zones.map(normalizeZone);
    if(rows.some(x=>x===null)||new Set(rows.map(x=>x.zoneId)).size!==rows.length)return null;
    return {zones:rows};
  }
  if(data.zoneId!==zoneId||!Array.isArray(data.methods)||data.methods.length>50)return null;
  const rows=data.methods.map(normalizeMethod);
  if(rows.some(x=>x===null)||new Set(rows.map(x=>x.instanceId)).size!==rows.length)return null;
  return {zoneId,methods:rows};
}
/**
 * readPage and lock are trusted adapter dependencies, NEVER request fields.
 * readPage must observe a bound existing Dev browser tab without navigation.
 * All data emitted is a typed whitelist, not raw HTML, headers, cookies or nonces.
 */
export async function auditDevShipping(input,{principal,windowPid,readPage,lock}={}) {
  const gate=validateShippingAuditRequest(input);
  if(!gate.ok)return gate;
  if(!obj(principal)||principal.kind!=='verified-dev-operator'||
    principal.readOnlyApproved!==true)return fail('OPERATOR_DENIED');
  if(!integer(windowPid,2147483647)||windowPid===0)return fail('WINDOW_PID_REQUIRED');
  if(typeof readPage!=='function'||typeof lock!=='function')return fail('ADAPTER_UNAVAILABLE');
  try{
    const result=await lock(async()=>{
      const snapshot=await readPage(Object.freeze({
        operation:gate.operation,zoneId:gate.zoneId,
        expectedUrl:gate.expectedUrl,method:'GET',windowPid
      }));
      if(!checkEvidence(snapshot,gate.expectedUrl,windowPid))return fail('SOURCE_NOT_VERIFIED');
      const normalized=normalizeRows(gate.operation,snapshot.data,gate.zoneId);
      if(!normalized)return fail('UNTRUSTED_DATA_DENIED');
      return Object.freeze({ok:true,schema:'wp_shipping_audit_readonly.a2',
        environment:'DEV',site:DEV_HOST,operation:gate.operation,
        source:'verified-bound-browser-adapter',verified:true,...normalized});
    });
    return obj(result)&&typeof result.ok==='boolean'?result:fail('LOCK_RESULT_INVALID');
  }catch(e){
    const code=typeof e?.code==='string'&&CODES.has(e.code)?e.code:'INSPECTION_FAILED_CLOSED';
    return fail(code);
  }
}
