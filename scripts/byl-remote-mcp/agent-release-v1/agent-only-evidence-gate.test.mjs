import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash, generateKeyPairSync,sign} from 'node:crypto';
import {signingBytes, verifyAgentOnlyReceipts, evidenceGapStatus, SOURCE_V1} from './agent-only-evidence-gate.mjs';

const SHA={installed:'a'.repeat(64),dependencies:'b'.repeat(64),old:'c'.repeat(64),
  artifact:'d'.repeat(64),witness:'e'.repeat(64)};
const when={
  captured:'2026-10-12T10:00:00.000Z',
  installed:'2026-10-16T11:50:00.000Z',
  started:'2026-10-16T11:51:00.000Z',
  observed:'2026-10-16T11:52:00.000Z',
  restored:'2026-10-16T11:54:00.000Z',
  signed:'2026-10-16T12:00:00.000Z'
};
const ROLES=['deployment','runtime-observer','recovery-witness'];
function createFixture(){
  const keys=Object.fromEntries(ROLES.map(role=>[role,generateKeyPairSync('ed25519')]));
  const payload={
    deployment:{
      deploymentId:'agent-usmini-v1-20261016',
      gitCommit:SOURCE_V1.githubCommit,sourceTarSha256:SOURCE_V1.signedTarSha256,
      installedCodeSha256:SHA.installed,installedDepsSha256:SHA.dependencies,
      installedAt:when.installed,processPid:90123,
      processStartToken:'start-agent-release-20261016-90123',
      processStartedAt:when.started
    },
    'runtime-observer':{
      deploymentId:'agent-usmini-v1-20261016',installedCodeSha256:SHA.installed,
      processPid:90123,processStartToken:'start-agent-release-20261016-90123',
      observedAt:when.observed,serviceHealth:'HEALTHY'
    },
    'recovery-witness':{
      deploymentId:'agent-usmini-v1-20261016',backupId:'backup-older-20261012',
      rollbackArtifactSha256:SHA.artifact,rollbackCodeSha256:SHA.old,
      capturedAt:when.captured,isolatedRestoreAt:when.restored,
      restoredCodeSha256:SHA.old,restoreResult:'PASS',
      witnessRecordSha256:SHA.witness
    }
  };
  const trustRoots=Object.fromEntries(ROLES.map(role=>{
    const pair=keys[role];
    const publicKeyPem=pair.publicKey.export({format:'pem',type:'spki'}).toString();
    const approvedFingerprint=createHash('sha256').update(
      pair.publicKey.export({format:'der',type:'spki'})).digest('hex');
    return [role,{publicKeyPem,approvedFingerprint}];
  }));
  function receipt(role,override=payload[role]){
    const issuerId=role==='deployment'?'approved-deployment':
      role==='runtime-observer'?'independent-runtime':'independent-recovery';
    const body={schema:'aicc-agent-only-evidence-receipt/v1',role,
      deviceId:'us-macmini',serviceLabel:'com.byl.remote-mcp-us-agent',
      issuerId,issuedAt:when.signed,payload:override};
    return {body,keyFingerprint:trustRoots[role].approvedFingerprint,
      signatureBase64:sign(null,signingBytes(body),keys[role].privateKey).toString('base64')};
  }
  const receipts=Object.fromEntries(ROLES.map(role=>[role,receipt(role)]));
  return {receipts,trustRoots,keys,receipt,payload};
}
test('actual current stage remains STOP without enrolled service owner receipts',()=>{
  const gap=evidenceGapStatus();
  assert.equal(gap.signedSourceAttestation,'PASS');
  assert.equal(gap.liveLaunchdObservation,'PROCESS_ONLY');
  assert.equal(gap.sealedAgentOnlyRollbackReceipt,'MISSING');
  assert.equal(gap.agentOnlyCanary,'STOP');
  assert.throws(()=>verifyAgentOnlyReceipts({}),/REQUIRED_EVIDENCE_MISSING/);
});
test('three synthetic distinct signed issuers verify, but NEVER produce production GO',()=>{
  const f=createFixture();
  const r=verifyAgentOnlyReceipts(f);
  assert.equal(r.receiptSignatureIntegrity,'PASS');
  assert.equal(r.receiptCrossBinding,'PASS');
  assert.equal(r.issuerKeyIndependence,'PASS');
  assert.equal(r.externalTrustEnrollment,'NOT_VERIFIED');
  assert.equal(r.installedRuntimeBytes,'NOT_INDEPENDENTLY_PROVEN');
  assert.equal(r.physicalRollbackRestore,'NOT_INDEPENDENTLY_PROVEN');
  assert.equal(r.agentOnlyCanary,'STOP');
});
test('tampering a signed code digest is rejected',()=>{
  const f=createFixture();
  f.receipts.deployment.body.payload.installedCodeSha256='f'.repeat(64);
  assert.throws(()=>verifyAgentOnlyReceipts(f),/RECEIPT_SIGNATURE_INVALID/);
});
test('unapproved key fingerprint or substituted trust root is rejected',()=>{
  const f=createFixture();
  f.trustRoots.deployment.approvedFingerprint='f'.repeat(64);
  assert.throws(()=>verifyAgentOnlyReceipts(f),/UNAPPROVED_KEY_FINGERPRINT/);
});
test('same signer for deployment and runtime observation is rejected',()=>{
  const f=createFixture();
  f.trustRoots['runtime-observer']=f.trustRoots.deployment;
  const body=f.receipt('runtime-observer').body;
  // Authenticate the runtime claim using the SAME key as deployment;
  // this must fail independence even if both signatures are valid.
  f.receipts['runtime-observer']={
    body,keyFingerprint:f.trustRoots.deployment.approvedFingerprint,
    signatureBase64:sign(null,signingBytes(body),f.keys.deployment.privateKey).toString('base64')
  };
  assert.throws(()=>verifyAgentOnlyReceipts(f),/INDEPENDENT_ISSUERS_REQUIRED/);
});
test('Oct 13 running process cannot be claimed to run Oct 16 signed source',()=>{
  const f=createFixture();
  const bad={...f.payload.deployment,installedAt:'2026-10-13T10:00:00.000Z',
    processStartedAt:'2026-10-13T10:01:00.000Z'};
  f.receipts.deployment=f.receipt('deployment',bad);
  assert.throws(()=>verifyAgentOnlyReceipts(f),/INSTALL_PREDATES_SOURCE_SIGNATURE/);
});
test('PID and process start token must match independent observer statement',()=>{
  const f=createFixture();
  f.receipts['runtime-observer']=f.receipt('runtime-observer',{
    ...f.payload['runtime-observer'],processPid:40746});
  assert.throws(()=>verifyAgentOnlyReceipts(f),/RUNTIME_DEPLOYMENT_NOT_BOUND/);
});
test('source TAR digest cannot be replaced even with a fresh synthetic signature',()=>{
  const f=createFixture();
  f.receipts.deployment=f.receipt('deployment',{
    ...f.payload.deployment,sourceTarSha256:'f'.repeat(64)});
  assert.throws(()=>verifyAgentOnlyReceipts(f),/SOURCE_ATTESTATION_BINDING_MISMATCH/);
});
test('rollback reported restored hash must match previous sealed code hash',()=>{
  const f=createFixture();
  f.receipts['recovery-witness']=f.receipt('recovery-witness',{
    ...f.payload['recovery-witness'],restoredCodeSha256:'f'.repeat(64)});
  assert.throws(()=>verifyAgentOnlyReceipts(f),/RECOVERY_CROSS_CHECK_FAILED/);
});
test('same code under rollback label does not establish old independent version',()=>{
  const f=createFixture();
  f.receipts['recovery-witness']=f.receipt('recovery-witness',{
    ...f.payload['recovery-witness'],rollbackCodeSha256:SHA.installed,
    restoredCodeSha256:SHA.installed});
  assert.throws(()=>verifyAgentOnlyReceipts(f),/RECOVERY_CROSS_CHECK_FAILED/);
});
test('rollback must be captured before new signed deployment',()=>{
  const f=createFixture();
  f.receipts['recovery-witness']=f.receipt('recovery-witness',{
    ...f.payload['recovery-witness'],capturedAt:'2026-10-16T11:57:00.000Z',
    isolatedRestoreAt:'2026-10-16T11:58:00.000Z'});
  assert.throws(()=>verifyAgentOnlyReceipts(f),/RECOVERY_CROSS_CHECK_FAILED/);
});
test('false rehearsal result is rejected even if it has a valid synthetic signature',()=>{
  const f=createFixture();
  f.receipts['recovery-witness']=f.receipt('recovery-witness',{
    ...f.payload['recovery-witness'],restoreResult:'FAIL'});
  assert.throws(()=>verifyAgentOnlyReceipts(f),/RECOVERY_CROSS_CHECK_FAILED/);
});
test('unbound signer identity and bogus service label rejected',()=>{
  const f=createFixture();
  const b={...f.receipts.deployment.body,serviceLabel:'com.unknown.agent'};
  f.receipts.deployment={...f.receipts.deployment,body:b,
    signatureBase64:sign(null,signingBytes(b),f.keys.deployment.privateKey).toString('base64')};
  assert.throws(()=>verifyAgentOnlyReceipts(f),/RECEIPT_IDENTITY_INVALID/);
});
test('time travel in independent observation rejected',()=>{
  const f=createFixture();
  f.receipts['runtime-observer']=f.receipt('runtime-observer',{
    ...f.payload['runtime-observer'],observedAt:'2026-10-16T11:49:00.000Z'});
  assert.throws(()=>verifyAgentOnlyReceipts(f),/RUNTIME_OBSERVATION_INVALID/);
});
