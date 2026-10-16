/**
 * Agent-only V1 release + rollback receipt integrity validator.
 * OFFLINE and FAIL CLOSED: no process, network, launchd or filesystem inspection,
 * no release/rollback execution, no credentials or signing private keys.
 *
 * Pinned GitHub SOURCE attestation below is authentic historical evidence, NOT
 * proof that the process started on 2026-10-13 loaded those 2026-10-16 bytes.
 * External trust-root enrollment and independent production owner authorization
 * are never derived from caller-supplied keys or self-asserted receipts.
 */
import {createHash, createPublicKey, verify as edVerify} from 'node:crypto';

export const SOURCE_V1 = Object.freeze({
  githubCommit:'78eec45b54fdb830ac7cca68793158e0fd6270c1',
  signedTarSha256:'3b83579f4b058a9f6e0ddfd4273bd33e40f2879aeb0dd72d901205927c0e4c6b',
  attestationId:56640305,
  sourceSignedAt:'2026-10-16T11:31:40.853Z'
});
export const EVIDENCE_DOMAIN='AICC_AGENT_ONLY_EVIDENCE_V1\n';
const RECEIPT_SCHEMA='aicc-agent-only-evidence-receipt/v1';
const DEVICE='us-macmini';
const LABEL='com.byl.remote-mcp-us-agent';
const ROLES=['deployment','runtime-observer','recovery-witness'];
const SHA=/^[0-9a-f]{64}$/;
const ID=/^[a-z0-9][a-z0-9-]{6,100}$/;
const TOKEN=/^[a-zA-Z0-9][a-zA-Z0-9:_-]{7,127}$/;
const SIGNATURE=/^[a-zA-Z0-9+/]{86}==$/;
const MAX_RECEIPT_BYTES=16384;
const PAYLOAD_KEYS={
  deployment:['deploymentId','gitCommit','sourceTarSha256','installedCodeSha256',
    'installedDepsSha256','installedAt','processPid','processStartToken','processStartedAt'],
  'runtime-observer':['deploymentId','installedCodeSha256','processPid',
    'processStartToken','observedAt','serviceHealth'],
  'recovery-witness':['deploymentId','backupId','rollbackArtifactSha256','rollbackCodeSha256',
    'capturedAt','isolatedRestoreAt','restoredCodeSha256','restoreResult','witnessRecordSha256']
};
function deny(reason){throw Object.assign(new Error(reason),{code:reason});}
function object(v){return v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;}
function keys(v,expected){
  return object(v)&&JSON.stringify(Object.keys(v).sort())===JSON.stringify([...expected].sort());
}
function utc(s){
  if(typeof s!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s)||
      !Number.isFinite(Date.parse(s))||new Date(s).toISOString()!==s)deny('INVALID_UTC_TIMESTAMP');
  return Date.parse(s);
}
function digest(data){return createHash('sha256').update(data).digest('hex');}
function canonical(v,depth=0){
  if(depth>12)deny('EVIDENCE_TOO_DEEP');
  if(v===null)return 'null';
  if(typeof v==='string')return JSON.stringify(v);
  if(typeof v==='boolean')return v?'true':'false';
  if(typeof v==='number'&&Number.isSafeInteger(v))return String(v);
  if(Array.isArray(v))return '['+v.map(x=>canonical(x,depth+1)).join(',')+']';
  if(object(v)){
    const ks=Object.keys(v).sort();
    if(ks.some(k=>k==='__proto__'||k==='constructor'||k==='prototype'))deny('PROTOTYPE_KEY_DENIED');
    return '{'+ks.map(k=>JSON.stringify(k)+':'+canonical(v[k],depth+1)).join(',')+'}';
  }
  deny('EVIDENCE_NOT_CANONICAL_JSON');
}
export function signingBytes(body){
  return Buffer.from(EVIDENCE_DOMAIN+canonical(body),'utf8');
}
function checkReceipt(role,receipt,root){
  if(!keys(receipt,['body','signatureBase64','keyFingerprint'])||
      !keys(receipt.body,['schema','role','deviceId','serviceLabel','issuerId','issuedAt','payload'])||
      !keys(root,['publicKeyPem','approvedFingerprint']))deny('RECEIPT_OR_ROOT_SHAPE_INVALID');
  const b=receipt.body;
  if(b.schema!==RECEIPT_SCHEMA||b.role!==role||b.deviceId!==DEVICE||
      b.serviceLabel!==LABEL||!ID.test(b.issuerId)||!keys(b.payload,PAYLOAD_KEYS[role]))deny('RECEIPT_IDENTITY_INVALID');
  if(!SIGNATURE.test(receipt.signatureBase64)||!SHA.test(receipt.keyFingerprint)||
      !SHA.test(root.approvedFingerprint))deny('RECEIPT_SIGNATURE_FORMAT_INVALID');
  const bytes=signingBytes(b);
  if(bytes.length>MAX_RECEIPT_BYTES)deny('RECEIPT_TOO_LARGE');
  let key;
  try{key=createPublicKey(root.publicKeyPem);}
  catch{deny('RECEIPT_PUBLIC_KEY_INVALID');}
  if(key.asymmetricKeyType!=='ed25519')deny('ED25519_REQUIRED');
  const fingerprint=digest(key.export({format:'der',type:'spki'}));
  if(fingerprint!==receipt.keyFingerprint||fingerprint!==root.approvedFingerprint)
    deny('UNAPPROVED_KEY_FINGERPRINT');
  if(!edVerify(null,bytes,key,Buffer.from(receipt.signatureBase64,'base64')))
    deny('RECEIPT_SIGNATURE_INVALID');
  const issued=utc(b.issuedAt),payload=b.payload;
  for(const [k,v] of Object.entries(payload)){
    if(k.endsWith('At'))utc(v);
    else if(k.endsWith('Sha256')||k==='gitCommit'){
      if(typeof v!=='string'||!(k==='gitCommit'?/^[0-9a-f]{40}$/:SHA).test(v))
        deny('RECEIPT_HASH_INVALID');
    }
    else if(k==='processPid'){
      if(!Number.isSafeInteger(v)||v<1||v>4_194_304)deny('RECEIPT_PID_INVALID');
    }
    else if(['deploymentId','backupId'].includes(k)){
      if(typeof v!=='string'||!ID.test(v))deny('RECEIPT_ID_INVALID');
    }
    else if(k==='processStartToken'){
      if(typeof v!=='string'||!TOKEN.test(v))deny('PROCESS_START_TOKEN_INVALID');
    }
  }
  if(issued<utc(Object.values(payload).filter((_,i)=>Object.keys(payload)[i].endsWith('At')).sort().at(-1)||b.issuedAt)){
    // This precheck is supplemented by the explicit temporal constraints below.
    // No operation is released based on issuer timestamps alone.
  }
  return {body:b,payload,issued,fingerprint};
}

/**
 * Verifies only detached receipt integrity and cross-document invariants.
 * A caller can supply self-created keys, so passing this function NEVER proves
 * issuer enrollment, current process bytes, an actual restore, or rollout GO.
 */
export function verifyAgentOnlyReceipts({receipts,trustRoots}={}){
  if(!keys(receipts,ROLES)||!keys(trustRoots,ROLES))deny('REQUIRED_EVIDENCE_MISSING');
  const rows=Object.fromEntries(ROLES.map(role=>[role,checkReceipt(role,receipts[role],trustRoots[role])]));
  const d=rows.deployment,p=d.payload;
  const o=rows['runtime-observer'],q=o.payload;
  const w=rows['recovery-witness'],r=w.payload;
  const identities=ROLES.map(role=>rows[role].body.issuerId);
  if(new Set(identities).size!==3||new Set(ROLES.map(role=>rows[role].fingerprint)).size!==3)
    deny('INDEPENDENT_ISSUERS_REQUIRED');
  if(p.gitCommit!==SOURCE_V1.githubCommit||p.sourceTarSha256!==SOURCE_V1.signedTarSha256)
    deny('SOURCE_ATTESTATION_BINDING_MISMATCH');
  if(utc(p.installedAt)<utc(SOURCE_V1.sourceSignedAt))
    deny('INSTALL_PREDATES_SOURCE_SIGNATURE');
  if(utc(p.processStartedAt)<utc(p.installedAt)||d.issued<utc(p.processStartedAt))
    deny('DEPLOYMENT_TIMELINE_INVALID');
  if(p.deploymentId!==q.deploymentId||p.deploymentId!==r.deploymentId||
      p.processPid!==q.processPid||p.processStartToken!==q.processStartToken||
      p.installedCodeSha256!==q.installedCodeSha256)
    deny('RUNTIME_DEPLOYMENT_NOT_BOUND');
  if(q.serviceHealth!=='HEALTHY'||utc(q.observedAt)<utc(p.processStartedAt)||
      o.issued<utc(q.observedAt))deny('RUNTIME_OBSERVATION_INVALID');
  if(utc(r.capturedAt)>=utc(p.installedAt)||utc(r.isolatedRestoreAt)<utc(r.capturedAt)||
      w.issued<utc(r.isolatedRestoreAt)||r.restoreResult!=='PASS'||
      r.rollbackCodeSha256!==r.restoredCodeSha256||
      r.rollbackCodeSha256===p.installedCodeSha256)
    deny('RECOVERY_CROSS_CHECK_FAILED');
  if(utc(r.capturedAt)>utc(p.processStartedAt))deny('ROLLBACK_SNAPSHOT_TOO_NEW');
  // The signed receipts claim these facts; they do not independently prove them.
  return Object.freeze({
    receiptSignatureIntegrity:'PASS',
    receiptCrossBinding:'PASS',
    issuerKeyIndependence:'PASS',
    pinnedGitHubSourceSubject:'MATCHED',
    externalTrustEnrollment:'NOT_VERIFIED',
    installedRuntimeBytes:'NOT_INDEPENDENTLY_PROVEN',
    physicalRollbackRestore:'NOT_INDEPENDENTLY_PROVEN',
    ownerReleaseAuthorization:'NOT_PROVIDED',
    agentOnlyCanary:'STOP',
    oauthCanary:'STOP',
    ownerUat:'OPEN'
  });
}

export function evidenceGapStatus(){
  return Object.freeze({
    signedSourceAttestation:'PASS',
    liveLaunchdObservation:'PROCESS_ONLY',
    enrolledIssuerKeys:'MISSING',
    signedDeploymentReceipt:'MISSING',
    signedIndependentRuntimeReceipt:'MISSING',
    sealedAgentOnlyRollbackReceipt:'MISSING',
    isolatedRollbackRehearsal:'UNVERIFIED',
    agentOnlyCanary:'STOP',
    oauthCanary:'STOP'
  });
}
