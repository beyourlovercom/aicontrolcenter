/**
 * A5 fixed Woo instance-detail audit contract.
 * NO caller-provided URL or ID. The IDs below were observed in Owner-approved
 * WWW Methods list exports on 2026-10-21. These are PRIOR zone associations,
 * not assertions about the current Dev or WWW settings detail page.
 */
export const INSTANCE_DETAILS_SCHEMA='wp_shipping_instance_details_readonly.v1';
const HOSTS=Object.freeze({DEV:'dev.beyourlover.com',WWW:'www.beyourlover.com'});
const INSTANCE_MATRIX=Object.freeze([
  Object.freeze({zoneId:0,instanceId:1,kind:'free_shipping'}),
  Object.freeze({zoneId:0,instanceId:3,kind:'flat_rate'}),
  Object.freeze({zoneId:5,instanceId:9,kind:'free_shipping'}),
  Object.freeze({zoneId:5,instanceId:10,kind:'flat_rate'}),
  Object.freeze({zoneId:4,instanceId:7,kind:'flat_rate'}),
  Object.freeze({zoneId:4,instanceId:8,kind:'free_shipping'}),
  Object.freeze({zoneId:3,instanceId:5,kind:'flat_rate'}),
  Object.freeze({zoneId:3,instanceId:6,kind:'free_shipping'}),
  Object.freeze({zoneId:1,instanceId:2,kind:'free_shipping'})
]);
const REQUIREMENTS=new Set(['','coupon','min_amount','either','both']);
const METHOD_TYPES=new Set(['class','order']);
const SAFE_MONEY=/^\d{1,8}(?:\.\d{1,2})?$/;
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const err=errorCode=>({ok:false,errorCode,executed:false});
const validCurrency=x=>typeof x==='string'&&(x===''||SAFE_MONEY.test(x));
const acceptMoney=x=>x===null||validCurrency(x);
const primitive=x=>x===null||typeof x==='string'||typeof x==='boolean';
const id=x=>Number.isSafeInteger(x)&&x>0&&x<=99999999;
const onlyKeys=(input,keys)=>Object.keys(input).every(k=>keys.includes(k));
const idSet=new Set(INSTANCE_MATRIX.map(x=>x.instanceId));
if(idSet.size!==INSTANCE_MATRIX.length)throw Error('STATIC_MATRIX_INVALID');

export function fixedInstanceBatchRequest(input){
  if(!isObj(input)||!onlyKeys(input,['environment','operation'])||
    !Object.prototype.hasOwnProperty.call(HOSTS,input.environment))
    return err('REQUEST_DENIED');
  if(input.operation!=='instanceBatch')return err('OPERATION_DENIED');
  const host=HOSTS[input.environment];
  return Object.freeze({
    ok:true,operation:'instanceBatch',environment:input.environment,host,
    origin:'https://'+host+'/',
    targets:Object.freeze(INSTANCE_MATRIX.map(item=>{
      const url=new URL('https://'+host+'/wp-admin/admin.php');
      url.searchParams.set('page','wc-settings');
      url.searchParams.set('tab','shipping');
      url.searchParams.set('instance_id',String(item.instanceId));
      return Object.freeze({...item,url:url.href,host,environment:input.environment});
    }))
  });
}
export function exactInstancePage(href,target){
  if(typeof href!=='string'||!target||!id(target.instanceId))return false;
  try{
    const parsed=new URL(href);
    return parsed.protocol==='https:'&&parsed.hostname===target.host&&
      parsed.username===''&&parsed.password===''&&parsed.hash===''&&
      parsed.href===target.url;
  }catch{return false;}
}
function cleanClassRows(rows){
  if(!Array.isArray(rows)||rows.length>40)return null;
  const result=[],seen=new Set();
  for(const row of rows){
    if(!isObj(row)||!onlyKeys(row,['classId','cost'])||!id(row.classId)||
      !acceptMoney(row.cost)||seen.has(row.classId))return null;
    seen.add(row.classId);
    result.push({classId:row.classId,cost:row.cost});
  }
  return result;
}
export function sanitizeInstanceDetail(raw,target){
  if(!isObj(raw)||raw.schema!=='wp_shipping_instance_dom.v1'||
    raw.instanceId!==target?.instanceId||raw.kind!==target.kind||
    !exactInstancePage(raw.pageUrl,target)||raw.uiVerified!==true)
    return err('INSTANCE_SOURCE_NOT_VERIFIED');
  const result={
    instanceId:target.instanceId,
    priorZoneId:target.zoneId,
    priorZoneSource:'WWW-method-list-2026-10-21',
    kind:target.kind,
    instancePageUrlVerified:true,
    partial:false
  };
  // Only the exact known controls are emitted; every other property on raw,
  // including HTML/nonce/cookie/email, is dropped.
  if(target.kind==='free_shipping'){
    if(!primitive(raw.requires)||!primitive(raw.minimum)||!primitive(raw.ignoreDiscounts))
      return err('INSTANCE_FIELDS_DENIED');
    if(raw.requires!==null&&!REQUIREMENTS.has(raw.requires))return err('INVALID_REQUIREMENT');
    if(raw.minimum!==null&&!validCurrency(raw.minimum))return err('INVALID_MINIMUM');
    if(raw.ignoreDiscounts!==null&&typeof raw.ignoreDiscounts!=='boolean')
      return err('INVALID_DISCOUNT_FLAG');
    result.requires=raw.requires;
    result.minAmount=raw.minimum;
    result.ignoreDiscounts=raw.ignoreDiscounts;
    result.partial=raw.requires===null||raw.minimum===null||raw.ignoreDiscounts===null;
  }else if(target.kind==='flat_rate'){
    if(!acceptMoney(raw.cost)||!acceptMoney(raw.noClassCost)||
      (raw.calculationType!==null&&!METHOD_TYPES.has(raw.calculationType)))
      return err('INVALID_RATE_FIELD');
    const classes=cleanClassRows(raw.classCosts);
    if(classes===null)return err('INVALID_CLASS_COSTS');
    result.cost=raw.cost;
    result.noClassCost=raw.noClassCost;
    result.calculationType=raw.calculationType;
    result.classCosts=classes;
    result.partial=raw.cost===null||raw.noClassCost===null||
      raw.calculationType===null||classes.some(x=>x.cost===null);
  }else return err('METHOD_NOT_ALLOWLISTED');
  return {ok:true,...result};
}
export function aggregateInstanceBatch(request,items,observedAt){
  if(!request?.ok||request.operation!=='instanceBatch'||!Array.isArray(items)||
    items.length!==request.targets.length||typeof observedAt!=='string')return err('INVALID_BATCH');
  const rows=[];
  for(let n=0;n<items.length;n++){
    const item=items[n];
    if(!isObj(item)||item.ok!==true||item.instanceId!==request.targets[n].instanceId||
      item.kind!==request.targets[n].kind)return err('UNVERIFIED_BATCH');
    // The item must already be sanitized; drop unrecognized objects even here.
    rows.push(item);
  }
  return {ok:true,schema:INSTANCE_DETAILS_SCHEMA,
    environment:request.environment,site:request.host,
    operation:'instanceBatch',source:'owner-consented-chrome-fixed-get',
    observedAt,partial:rows.some(row=>row.partial),count:rows.length,
    details:rows};
}
export function safeBatchFilename(request,at){
  if(!request?.ok||request.operation!=='instanceBatch'||!(at instanceof Date)||
    !Number.isFinite(at.getTime()))return null;
  return 'BYL-shipping-readonly-'+request.environment+'-instances-9-'+
    at.toISOString().replace(/[:.]/g,'-')+'.json';
}
