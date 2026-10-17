import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {authorizationBytes,retainPresealedLegacyBackup} from './agent-only-presealed-intake.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex');
function fixture() {
  const bytes=Buffer.from('isolated-generated-test-ciphertext-not-actual-agent-data');
  const keyPair=generateKeyPairSync('ed25519');
  const trustAnchor={publicKeyPem:keyPair.publicKey.export({format:'pem',type:'spki'}).toString(),
    approvedSpkiSha256:digest(keyPair.publicKey.export({format:'der',type:'spki'}))};
  const body={schema:'aicc-agent-only-presealed-intake/v1',deviceId:'us-macmini',
    serviceLabel:'com.byl.remote-mcp-us-agent',kind:'PRESEALED_CIPHERTEXT_ONLY',
    classification:'legacy-baseline-with-unknown-source',backupId:'backup-owner-20261017',
    ciphertextSha256:digest(bytes),ciphertextBytes:bytes.length,sourceManifestSha256:'a'.repeat(64),
    captureReceiptId:'receipt-owner-capture',offWindowsKeyCustodyReceiptId:'escrow-other-device',
    issuedAt:new Date(Date.now()-60_000).toISOString(),
    expiresAt:new Date(Date.now()+600_000).toISOString()};
  function receipt(b=body) {return {body:b,signatureBase64:sign(null,authorizationBytes(b),keyPair.privateKey).toString('base64')};}
  const primaryStore={failureDomainId:'windows-disk-two',async writeOnceAndReadBack(id,bytes){return Buffer.from(bytes)}};
  const independentStore={failureDomainId:'off-host-replica',async writeOnceAndReadBack(id,bytes){return Buffer.from(bytes)}};
  const claimedIds=new Set();
  const receiptLedger={async reserveOnce(id){if(claimedIds.has(id))return false; claimedIds.add(id);return true;}};
  return {ciphertext:bytes,authorization:receipt(),trustAnchor,primaryStore,independentStore,receipt,receiptLedger};
}
test('presealed ciphertext readback is operational; not a legacy Agent export or release GO',async()=>{
  const f=fixture();const r=await retainPresealedLegacyBackup(f);
  assert.equal(r.presealedIntake,'CIPHERTEXT_READBACK_MATCHED');
  assert.notEqual(r.primary.domain,r.replica.domain);
  assert.equal(r.sourceCapture,'NOT_INDEPENDENTLY_VERIFIED');
  assert.equal(r.externalIssuerEnrollment,'NOT_INDEPENDENTLY_VERIFIED');
  assert.equal(r.agentOnlyCanary,'STOP');
});
test('tampered ciphertext never reaches either storage',async()=>{
  const f=fixture();let writes=0;f.ciphertext[0]^=1;
  f.primaryStore.writeOnceAndReadBack=async()=>{writes++;return f.ciphertext;};
  await assert.rejects(retainPresealedLegacyBackup(f),/BACKUP_SUBJECT_MISMATCH/);
  assert.equal(writes,0);
});
test('no forged or expired authorization is accepted',async()=>{
  const f=fixture();f.authorization.body.backupId='backup-modified-20261017';
  await assert.rejects(retainPresealedLegacyBackup(f),/SIGNATURE_INVALID/);
  const g=fixture();
  const stale={...g.authorization.body,
    issuedAt:new Date(Date.now()-7_200_000).toISOString(),
    expiresAt:new Date(Date.now()-3_600_000).toISOString()};
  g.authorization=g.receipt(stale);
  // A caller-supplied fake clock must not extend the issuer's signed expiry.
  await assert.rejects(retainPresealedLegacyBackup({...g,now:new Date('2026-10-17T04:00:00Z')}),/AUTHORIZATION_EXPIRED_OR_FUTURE/);
});
test('issuer key substitution and self-disjoint storage domain fail closed',async()=>{
  const f=fixture();f.trustAnchor.approvedSpkiSha256='0'.repeat(64);
  await assert.rejects(retainPresealedLegacyBackup(f),/TRUST_FINGERPRINT_MISMATCH/);
  const g=fixture();g.independentStore.failureDomainId=g.primaryStore.failureDomainId;
  await assert.rejects(retainPresealedLegacyBackup(g),/INDEPENDENT_STORAGE_REQUIRED/);
});
test('stale or non-identical replica readback fails',async()=>{
  const f=fixture();f.independentStore.writeOnceAndReadBack=async()=>Buffer.from('incorrect');
  await assert.rejects(retainPresealedLegacyBackup(f),/STORAGE_READBACK_MISMATCH/);
});
test('no private-file locations, shell, process, secrets, network or source export functions are exposed',()=>{
  assert.equal(typeof retainPresealedLegacyBackup,'function');
  assert.equal(retainPresealedLegacyBackup.length,0);
});

test('a second use of the same signed backup ID is denied before either store can write',async()=>{
  const f=fixture();let writes=0;
  f.primaryStore.writeOnceAndReadBack=async(_id,bytes)=>{writes++;return Buffer.from(bytes)};
  await retainPresealedLegacyBackup(f);
  await assert.rejects(retainPresealedLegacyBackup(f),/AUTHORIZATION_REPLAY_DENIED/);
  assert.equal(writes,1);
});
test('missing durable one-time ledger fails closed before either storage write',async()=>{
  const f=fixture();delete f.receiptLedger;
  let writes=0;
  f.primaryStore.writeOnceAndReadBack=async()=>{writes++;return f.ciphertext};
  await assert.rejects(retainPresealedLegacyBackup(f),/DURABLE_REPLAY_LEDGER_REQUIRED/);
  assert.equal(writes,0);
});
test('a storage adapter cannot mutate plaintext/ciphertext bytes passed to the next store',async()=>{
  const f=fixture();
  let replicaSawOriginal=false;
  f.primaryStore.writeOnceAndReadBack=async(_id,bytes)=>{
    const readBack=Buffer.from(bytes);
    bytes[0]^=1;
    return readBack;
  };
  f.independentStore.writeOnceAndReadBack=async(_id,bytes)=>{
    replicaSawOriginal=bytes.equals(f.ciphertext);
    return Buffer.from(bytes);
  };
  await retainPresealedLegacyBackup(f);
  assert.equal(replicaSawOriginal,true);
});
