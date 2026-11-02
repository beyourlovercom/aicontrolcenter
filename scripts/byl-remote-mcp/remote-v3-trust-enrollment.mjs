/**
 * AICC DC S3 — offline owner-issued device trust ENROLLMENT CANDIDATE gate.
 * Pure, fail-closed verifier; NO network/agent/filesystem/keys export/activation.
 *
 * Verifying an Ed25519 signature against a caller-provided root does not prove
 * that the root was independently approved. An authorized service owner must
 * enroll the exact issuer SPKI fingerprint OUTSIDE this code and chat. Previous
 * epoch records likewise require independent durable custody.
 */
import {createHash,createPublicKey,verify as edVerify} from 'node:crypto';

export const ENROLLMENT_DOMAIN='AICC_DC_SIGNED_HEALTH_TRUST_ENROLLMENT_V1\n';
export const ENROLLMENT_SCHEMA='aicc-dc-signed-health-trust/v1';
export const ENROLLED_DEVICES=Object.freeze(['007windows','china-mac','us-macmini','windows']);
const SHA=/^[a-f0-9]{64}$/;
const ID=/^[a-z0-9][a-z0-9-]{6,100}$/;
const ZERO='0'.repeat(64);
const MAX_BYTES=32768;
const MAX_VALIDITY_MS=30*24*60*60*1000;
const FUTURE_MS=5*60*1000;
const keys=(v,ks)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
  Object.getPrototypeOf(v)===Object.prototype&&
  JSON.stringify(Object.keys(v).sort())===JSON.stringify([...ks].sort());
const deny=(why)=>{throw Object.assign(Error(why),{code:why});};
const digest=v=>createHash('sha256').update(v).digest('hex');
function canonical(v,depth=0) {
  if(depth>10)deny('MANIFEST_DEPTH_LIMIT');
  if(v===null)return 'null';
  if(typeof v==='string')return JSON.stringify(v);
  if(typeof v==='boolean')return v?'true':'false';
  if(Number.isSafeInteger(v))return String(v);
  if(Array.isArray(v))return '['+v.map(x=>canonical(x,depth+1)).join(',')+']';
  if(v!==null&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype) {
    const ks=Object.keys(v).sort();
    if(ks.some(k=>['__proto__','prototype','constructor'].includes(k)))
      deny('PROTOTYPE_KEY_DENIED');
    return '{'+ks.map(k=>JSON.stringify(k)+':'+canonical(v[k],depth+1)).join(',')+'}';
  }
  deny('NON_CANONICAL_DATA');
}
/** Signed context domain avoids accidental cross-protocol authorization. */
export function enrollmentSigningBytes(body) {
  return Buffer.from(ENROLLMENT_DOMAIN+canonical(body),'utf8');
}
function parseUTC(s) {
  if(typeof s!=='string'||! /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s)||
    !Number.isFinite(Date.parse(s))||new Date(s).toISOString()!==s)
    deny('TIME_FORMAT_INVALID');
  return Date.parse(s);
}
function parseEd25519(publicKeyPem,declaredDigest){
  if(typeof publicKeyPem!=='string'||publicKeyPem.length>2048||!SHA.test(declaredDigest))
    deny('PUBLIC_KEY_FORMAT_INVALID');
  let key;
  try{key=createPublicKey(publicKeyPem);}catch{deny('PUBLIC_KEY_INVALID');}
  if(key.type!=='public'||key.asymmetricKeyType!=='ed25519')
    deny('ED25519_PUBLIC_KEY_REQUIRED');
  const fp=digest(key.export({format:'der',type:'spki'}));
  if(fp!==declaredDigest)deny('PUBLIC_KEY_FINGERPRINT_MISMATCH');
  return {key,fp};
}
/**
 * "verified" below means cryptographic syntax/signature consistency ONLY.
 * The returned candidate NEVER grants a live health call or activation.
 * External independent issuer enrollment, registry approval, witness receipts,
 * and durable epoch ledger must be checked before any separate runtime bind.
 */
export function verifyTrustEnrollmentCandidate({
  envelope,issuerTrust,previousRecord=null,now=Date.now()
}={}){
  if(!keys(envelope,['body','signatureBase64'])||
     !keys(issuerTrust,['publicKeyPem','approvedSpkiSha256']))
    deny('ENVELOPE_OR_ISSUER_TRUST_SHAPE_INVALID');
  const b=envelope.body;
  if(!keys(b,['schema','registryId','issuerId','epoch','previousManifestSha256',
    'issuedAt','expiresAt','devices']))
    deny('MANIFEST_SHAPE_INVALID');
  if(b.schema!==ENROLLMENT_SCHEMA||b.registryId!=='aicc-dc-four-device-v1'||
     typeof b.issuerId!=='string'||!ID.test(b.issuerId))
    deny('MANIFEST_IDENTITY_INVALID');
  if(!Number.isSafeInteger(b.epoch)||b.epoch<1||b.epoch>1_000_000||
     !SHA.test(b.previousManifestSha256))
    deny('EPOCH_INVALID');
  if(!Array.isArray(b.devices)||b.devices.length!==ENROLLED_DEVICES.length)
    deny('EXACT_FOUR_DEVICE_SET_REQUIRED');
  if(typeof now!=='number'||!Number.isFinite(now))deny('CLOCK_INVALID');
  const issued=parseUTC(b.issuedAt),expires=parseUTC(b.expiresAt);
  if(issued>now+FUTURE_MS||expires<=now||issued>=expires||
     expires-issued>MAX_VALIDITY_MS)deny('ENROLLMENT_TIME_INVALID');
  const signed=enrollmentSigningBytes(b);
  if(signed.length>MAX_BYTES)deny('MANIFEST_TOO_LARGE');
  if(typeof envelope.signatureBase64!=='string'||
     !/^[A-Za-z0-9+/]{86}==$/.test(envelope.signatureBase64))
    deny('SIGNATURE_FORMAT_INVALID');
  const issuer=parseEd25519(issuerTrust.publicKeyPem,issuerTrust.approvedSpkiSha256);
  if(!edVerify(null,signed,issuer.key,Buffer.from(envelope.signatureBase64,'base64')))
    deny('ISSUER_SIGNATURE_INVALID');
  const expectedEpoch=previousRecord===null?1:previousRecord?.epoch+1;
  const previousDigest=previousRecord===null?ZERO:previousRecord?.manifestSha256;
  if(previousRecord!==null&&
     (!keys(previousRecord,['epoch','manifestSha256'])||
      !Number.isSafeInteger(previousRecord.epoch)||previousRecord.epoch<1||
      !SHA.test(previousRecord.manifestSha256)))
    deny('PREVIOUS_EPOCH_RECORD_INVALID');
  if(b.epoch!==expectedEpoch||b.previousManifestSha256!==previousDigest)
    deny('EPOCH_REPLAY_OR_CHAIN_MISMATCH');
  const pins={};
  const seenKeys=new Set(),seenReceipts=new Set();
  for(let i=0;i<b.devices.length;i++){
    const d=b.devices[i];
    if(!keys(d,['deviceId','publicKeyPem','spkiSha256','externalWitnessReceiptId'])||
      d.deviceId!==ENROLLED_DEVICES[i]||
      typeof d.externalWitnessReceiptId!=='string'||!ID.test(d.externalWitnessReceiptId))
      deny('DEVICE_ENROLLMENT_SHAPE_INVALID');
    const k=parseEd25519(d.publicKeyPem,d.spkiSha256);
    if(seenKeys.has(k.fp)||k.fp===issuer.fp)deny('DEVICE_SIGNER_MUST_BE_DISTINCT');
    if(seenReceipts.has(d.externalWitnessReceiptId))deny('WITNESS_RECEIPT_DUPLICATED');
    seenKeys.add(k.fp);seenReceipts.add(d.externalWitnessReceiptId);
    pins[d.deviceId]=Object.freeze({
      publicKeyPem:d.publicKeyPem,spkiSha256:d.spkiSha256
    });
  }
  const manifestSha256=digest(signed);
  return Object.freeze({
    signatureVerified:true,
    externalIssuerEnrollment:'NOT_INDEPENDENTLY_VERIFIED',
    deviceWitnessReceipts:'NOT_INDEPENDENTLY_VERIFIED',
    durableEpochRecord:'NOT_INDEPENDENTLY_VERIFIED',
    eligibleForRuntime:false,
    canActivate:false,
    epoch:b.epoch,
    issuerSpkiSha256:issuer.fp,
    manifestSha256,
    candidatePins:Object.freeze(pins),
    proposedEpochRecord:Object.freeze({epoch:b.epoch,manifestSha256})
  });
}
