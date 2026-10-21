/**
 * A5 requires an explicit Owner confirmation of a recent completed Dev batch
 * before the extension can run the fixed 9-instance WWW batch.
 * This is a client-side consent gate, not server authentication or a substitute
 * for actual Owner visual UAT and independent compliance checks.
 */
export const DEV_A5_KEY='bylWpShippingA5OwnerGateV2';
export const A5_VERSION='0.2.1';
export const MAX_AGE_MS=48*60*60*1000;
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const isSHA=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const validDate=(value)=>{
  const time=Date.parse(value);
  return typeof value==='string'&&Number.isFinite(time)?time:NaN;
};
export function newDevReceipt(sha256,observedAt){
  if(!isSHA(sha256)||!Number.isFinite(validDate(observedAt)))return null;
  return {version:A5_VERSION,sha256,observedAt,instanceCount:9,
    ownerApprovedAt:null};
}
export function isDevReceiptAwaitingOwner(record,now=Date.now()){
  if(!isObject(record)||record.version!==A5_VERSION||
    !isSHA(record.sha256)||record.instanceCount!==9||
    record.ownerApprovedAt!==null||!Number.isFinite(now))return false;
  const created=validDate(record.observedAt);
  return Number.isFinite(created)&&created<=now&&now-created<MAX_AGE_MS;
}
export function ownerApproveDevReceipt(record,now=Date.now()){
  if(!isDevReceiptAwaitingOwner(record,now))return null;
  return {...record,ownerApprovedAt:new Date(now).toISOString()};
}
export function hasFreshOwnerDevApproval(record,now=Date.now()){
  if(!isObject(record)||record.version!==A5_VERSION||
    !isSHA(record.sha256)||record.instanceCount!==9||!Number.isFinite(now))
    return false;
  const created=validDate(record.observedAt);
  const approved=validDate(record.ownerApprovedAt);
  return Number.isFinite(created)&&Number.isFinite(approved)&&
    created<=approved&&approved<=now&&
    now-created<MAX_AGE_MS&&now-approved<MAX_AGE_MS;
}
