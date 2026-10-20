import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {ENROLLED_DEVICES,ENROLLMENT_SCHEMA,enrollmentSigningBytes,
  verifyTrustEnrollmentCandidate} from './remote-v3-trust-enrollment.mjs';

const fp=k=>createHash('sha256').update(k.export({format:'der',type:'spki'})).digest('hex');
const pem=k=>k.export({format:'pem',type:'spki'}).toString();
function fixture() {
  const issuer=generateKeyPairSync('ed25519');
  const pairs=Object.fromEntries(ENROLLED_DEVICES.map(id=>[id,generateKeyPairSync('ed25519')]));
  const now=1792400000000;
  const body={
    schema:ENROLLMENT_SCHEMA,registryId:'aicc-dc-four-device-v1',
    issuerId:'owner-issuer-aicc-001',epoch:1,previousManifestSha256:'0'.repeat(64),
    issuedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+600000).toISOString(),
    devices:ENROLLED_DEVICES.map(id=>({
      deviceId:id,publicKeyPem:pem(pairs[id].publicKey),
      spkiSha256:fp(pairs[id].publicKey),externalWitnessReceiptId:'witness-'+id+'-v001'
    }))
  };
  const issuerTrust={publicKeyPem:pem(issuer.publicKey),
    approvedSpkiSha256:fp(issuer.publicKey)};
  const seal=body=>({body,signatureBase64:sign(null,enrollmentSigningBytes(body),issuer.privateKey).toString('base64')});
  const verify=(envelope=seal(body),previousRecord=null,trust=issuerTrust,at=now)=>
    verifyTrustEnrollmentCandidate({envelope,issuerTrust:trust,previousRecord,now:at});
  return {now,body,pairs,issuer,issuerTrust,seal,verify};
}
test('exact 4 device sorted registry signed by issuer, but NEVER automatically activate',()=>{
 const f=fixture(), result=f.verify();
 assert.deepEqual(Object.keys(result.candidatePins),ENROLLED_DEVICES);
 assert.equal(result.signatureVerified,true);
 assert.equal(result.eligibleForRuntime,false);
 assert.equal(result.canActivate,false);
 assert.equal(result.externalIssuerEnrollment,'NOT_INDEPENDENTLY_VERIFIED');
 assert.equal(result.durableEpochRecord,'NOT_INDEPENDENTLY_VERIFIED');
 assert.equal(result.deviceWitnessReceipts,'NOT_INDEPENDENTLY_VERIFIED');
 assert.equal(result.epoch,1);
 assert(Object.isFrozen(result)&&Object.isFrozen(result.candidatePins));
});
test('tampering with any device key or witness receipt breaks detached signature',()=>{
 const f=fixture(), env=f.seal(f.body);
 env.body.devices[0].externalWitnessReceiptId='receipt-corrupted';
 assert.throws(()=>f.verify(env),/ISSUER_SIGNATURE_INVALID/);
});
test('substituted unapproved issuer root is rejected before false enrollment claim',()=>{
 const f=fixture();const forgedRoot={...f.issuerTrust,approvedSpkiSha256:'a'.repeat(64)};
 assert.throws(()=>f.verify(undefined,null,forgedRoot),/PUBLIC_KEY_FINGERPRINT_MISMATCH/);
});
test('unrelated issuer signature cannot validate exact trust root',()=>{
 const f=fixture(),wrong=generateKeyPairSync('ed25519');
 const bad={body:f.body,signatureBase64:sign(null,enrollmentSigningBytes(f.body),wrong.privateKey).toString('base64')};
 assert.throws(()=>f.verify(bad),/ISSUER_SIGNATURE_INVALID/);
});
test('bootstrap replay epoch 2 without independent previous record is blocked',()=>{
 const f=fixture(),modified={...f.body,epoch:2};
 assert.throws(()=>f.verify(f.seal(modified)),/EPOCH_REPLAY_OR_CHAIN_MISMATCH/);
});
test('rotation requires predecessor digest, exact increment and does not become runtime ready',()=>{
 const f=fixture(),base=f.verify(),after={
   ...f.body,epoch:2,previousManifestSha256:base.manifestSha256
 };
 const next=f.verify(f.seal(after),base.proposedEpochRecord);
 assert.equal(next.epoch,2);
 assert.equal(next.eligibleForRuntime,false);
 assert.throws(()=>f.verify(f.seal(after)),/EPOCH_REPLAY_OR_CHAIN_MISMATCH/);
 assert.throws(()=>f.verify(f.seal(after),{epoch:1,manifestSha256:'b'.repeat(64)}),
   /EPOCH_REPLAY_OR_CHAIN_MISMATCH/);
});
test('duplicate Ed25519 device key in second identity fails closed',()=>{
 const f=fixture(),d=f.body.devices;
 const forged={...f.body,devices:d.map((x,i)=>i===1?
   {...x,publicKeyPem:d[0].publicKeyPem,spkiSha256:d[0].spkiSha256}:x)};
 assert.throws(()=>f.verify(f.seal(forged)),/DEVICE_SIGNER_MUST_BE_DISTINCT/);
});
test('issuer cannot be enrolled as a device signing key',()=>{
 const f=fixture(),d=f.body.devices;
 const forged={...f.body,devices:d.map((x,i)=>i===0?
   {...x,publicKeyPem:f.issuerTrust.publicKeyPem,spkiSha256:f.issuerTrust.approvedSpkiSha256}:x)};
 assert.throws(()=>f.verify(f.seal(forged)),/DEVICE_SIGNER_MUST_BE_DISTINCT/);
});
test('duplicate external receipt ID rejects even valid issuer signature',()=>{
 const f=fixture(),d=f.body.devices;
 const forged={...f.body,devices:d.map((x,i)=>i===2?
   {...x,externalWitnessReceiptId:d[0].externalWitnessReceiptId}:x)};
 assert.throws(()=>f.verify(f.seal(forged)),/WITNESS_RECEIPT_DUPLICATED/);
});
test('missing / extra / out-of-order registry cannot pass',()=>{
 const f=fixture(),d=f.body.devices;
 assert.throws(()=>f.verify(f.seal({...f.body,devices:d.slice(1)})),/EXACT_FOUR_DEVICE_SET_REQUIRED/);
 assert.throws(()=>f.verify(f.seal({...f.body,devices:[...d].reverse()})),/DEVICE_ENROLLMENT_SHAPE_INVALID/);
 assert.throws(()=>f.verify(f.seal({...f.body,devices:d.map((x,i)=>i===0?{...x,deviceId:'malicious-domain'}:x)})),
 /DEVICE_ENROLLMENT_SHAPE_INVALID/);
});
test('past expiry and excessive validity are rejected',()=>{
 const f=fixture();
 const expired={...f.body,expiresAt:new Date(f.now-1).toISOString()};
 const overlong={...f.body,expiresAt:new Date(f.now+31*24*3600*1000).toISOString()};
 assert.throws(()=>f.verify(f.seal(expired)),/ENROLLMENT_TIME_INVALID/);
 assert.throws(()=>f.verify(f.seal(overlong)),/ENROLLMENT_TIME_INVALID/);
});
test('future-dated unapproved grant is invalid',()=>{
 const f=fixture();
 const future={...f.body,issuedAt:new Date(f.now+10*60*1000).toISOString(),
  expiresAt:new Date(f.now+20*60*1000).toISOString()};
 assert.throws(()=>f.verify(f.seal(future)),/ENROLLMENT_TIME_INVALID/);
});
test('bogus Ed25519 public key, hash mismatch and signature grammar fail closed',()=>{
 const f=fixture(),d=f.body.devices;
 assert.throws(()=>f.verify(f.seal({...f.body,devices:d.map((x,i)=>i===0?
   {...x,publicKeyPem:'NOT-A-KEY'}:x)})),/PUBLIC_KEY_INVALID/);
 assert.throws(()=>f.verify(f.seal({...f.body,devices:d.map((x,i)=>i===0?
   {...x,spkiSha256:'f'.repeat(64)}:x)})),/PUBLIC_KEY_FINGERPRINT_MISMATCH/);
 assert.throws(()=>f.verify({body:f.body,signatureBase64:'x'}),/SIGNATURE_FORMAT_INVALID/);
});
test('untrusted extra fields and prototypes must not slip into canonical signing',()=>{
 const f=fixture();
 assert.throws(()=>f.verify(f.seal({...f.body,arbitraryAdminOverride:true})),/MANIFEST_SHAPE_INVALID/);
 assert.throws(()=>enrollmentSigningBytes({constructor:{secret:'x'}}),/PROTOTYPE_KEY_DENIED/);
});
test('no signing key or credential is ever in result, even for valid manifest',()=>{
 const f=fixture(),r=f.verify(),serialized=JSON.stringify(r);
 assert(!serialized.includes('PRIVATE KEY'));
 assert(!serialized.includes('signatureBase64'));
 assert(!serialized.includes('witness-us-macmini'));
 assert(!Object.hasOwn(r,'activate'));
 assert(!Object.hasOwn(r,'send'));
});
