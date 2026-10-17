/**
 * AICC DC — encrypted legacy Agent backup INTAKE, not an Agent source exporter.
 * No filesystem, process, launchd, network, secret/key or runtime access.
 * Only an externally authorized service manager can supply a PRE-SEALED ciphertext.
 * The approved caller supplies separately controlled storage adapters and a
 * public trust anchor. This library does not enroll an issuer or approve release.
 */
import {createHash, createPublicKey, verify as verifySignature} from 'node:crypto';

const SCHEMA = 'aicc-agent-only-presealed-intake/v1';
const DOMAIN = 'AICC_AGENT_ONLY_PRESEALED_INTAKE_V1\n';
const DEVICE = 'us-macmini';
const SERVICE = 'com.byl.remote-mcp-us-agent';
const SHA256 = /^[a-f0-9]{64}$/;
const ID = /^[a-z][a-z0-9-]{7,95}$/;
const LIMIT_BYTES = 128 * 1024 * 1024;

function deny(message) { throw Object.assign(new Error(message), {code: message}); }
function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}
function canonical(value) {
  if (typeof value === 'string') return JSON.stringify(value);
  if (Number.isSafeInteger(value)) return String(value);
  if (value === true || value === false || value === null) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const keys = Object.keys(value).sort();
    if (keys.some(key => ['__proto__', 'constructor', 'prototype'].includes(key))) deny('UNSAFE_JSON_KEY');
    return '{' + keys.map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  deny('NONCANONICAL_JSON');
}
function sha(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function stamp(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s) ||
    !Number.isFinite(Date.parse(s)) || new Date(s).toISOString() !== s) deny('BAD_TIME');
  return Date.parse(s);
}
export function authorizationBytes(body) {
  return Buffer.from(DOMAIN + canonical(body), 'utf8');
}

/** Public-purpose bridge. Its issuer root MUST be provisioned by an external owner-managed trust registry. */
export async function retainPresealedLegacyBackup({ciphertext, authorization, trustAnchor,
  primaryStore, independentStore, receiptLedger} = {}) {
  if (!Buffer.isBuffer(ciphertext) || ciphertext.length === 0 || ciphertext.length > LIMIT_BYTES)
    deny('CIPHERTEXT_BYTES_REQUIRED');
  // Snapshot caller bytes before any await or untrusted storage-adapter call.
  const sealed = Buffer.from(ciphertext);
  if (!exactKeys(authorization, ['body', 'signatureBase64'])) deny('AUTHORIZATION_SHAPE_INVALID');
  const b = authorization.body;
  const fields = ['schema','deviceId','serviceLabel','kind','classification','backupId',
    'ciphertextSha256','ciphertextBytes','sourceManifestSha256','captureReceiptId',
    'offWindowsKeyCustodyReceiptId','issuedAt','expiresAt'];
  if (!exactKeys(b, fields) || b.schema !== SCHEMA || b.deviceId !== DEVICE ||
    b.serviceLabel !== SERVICE || b.kind !== 'PRESEALED_CIPHERTEXT_ONLY' ||
    b.classification !== 'legacy-baseline-with-unknown-source' ||
    ![b.backupId,b.captureReceiptId,b.offWindowsKeyCustodyReceiptId].every(id=>typeof id === 'string' && ID.test(id)) ||
    ![b.ciphertextSha256,b.sourceManifestSha256].every(h=>typeof h==='string' && SHA256.test(h)) ||
    !Number.isSafeInteger(b.ciphertextBytes) || b.ciphertextBytes !== sealed.length ||
    b.ciphertextSha256 !== sha(sealed)) deny('BACKUP_SUBJECT_MISMATCH');
  if (!exactKeys(trustAnchor, ['publicKeyPem','approvedSpkiSha256'])) deny('TRUST_ANCHOR_MISSING');
  let key;
  try {key = createPublicKey(trustAnchor.publicKeyPem);} catch {deny('BAD_TRUST_PUBLIC_KEY');}
  if (key.asymmetricKeyType !== 'ed25519' ||
    !SHA256.test(trustAnchor.approvedSpkiSha256) ||
    sha(key.export({format:'der',type:'spki'})) !== trustAnchor.approvedSpkiSha256)
    deny('TRUST_FINGERPRINT_MISMATCH');
  if (typeof authorization.signatureBase64 !== 'string' ||
    !/^[a-zA-Z0-9+/]{86}==$/.test(authorization.signatureBase64) ||
    !verifySignature(null, authorizationBytes(b), key,
      Buffer.from(authorization.signatureBase64, 'base64'))) deny('SIGNATURE_INVALID');
  const issue = stamp(b.issuedAt),expiry = stamp(b.expiresAt);
  // Production time is not caller-controlled; no public override that revives an expired grant.
  const clock = Date.now();
  if (!Number.isFinite(clock) || issue > clock || expiry <= clock || expiry - issue > 24*60*60*1000)
    deny('AUTHORIZATION_EXPIRED_OR_FUTURE');
  if (!primaryStore || !independentStore ||
    typeof primaryStore.writeOnceAndReadBack !== 'function' ||
    typeof independentStore.writeOnceAndReadBack !== 'function' ||
    typeof primaryStore.failureDomainId !== 'string' ||
    typeof independentStore.failureDomainId !== 'string' ||
    !ID.test(primaryStore.failureDomainId) || !ID.test(independentStore.failureDomainId) ||
    primaryStore.failureDomainId === independentStore.failureDomainId)
    deny('INDEPENDENT_STORAGE_REQUIRED');
  // External issuer-approved ledger MUST atomically and durably claim the backup ID.
  // Never retry a partially committed transfer without operator reconciliation.
  if (!receiptLedger || typeof receiptLedger.reserveOnce !== 'function')
    deny('DURABLE_REPLAY_LEDGER_REQUIRED');
  const claimed = await receiptLedger.reserveOnce(b.backupId,b.ciphertextSha256);
  if (claimed !== true) deny('AUTHORIZATION_REPLAY_DENIED');

  // Storage backends are approved/injected by an external service manager, not
  // specified by the input or this public repo. No private paths or keys here.
  const writeOne = async store => {
    const copy = await store.writeOnceAndReadBack(b.backupId, Buffer.from(sealed));
    if (!Buffer.isBuffer(copy) || copy.length !== sealed.length || sha(copy) !== b.ciphertextSha256)
      deny('STORAGE_READBACK_MISMATCH');
    return {domain: store.failureDomainId, readbackSha256: sha(copy)};
  };
  const primary = await writeOne(primaryStore);
  const replica = await writeOne(independentStore);
  return Object.freeze({
    backupId:b.backupId,ciphertextBytes:sealed.length,ciphertextSha256:b.ciphertextSha256,
    primary,replica,presealedIntake:'CIPHERTEXT_READBACK_MATCHED',
    sourceCapture:'NOT_INDEPENDENTLY_VERIFIED',externalIssuerEnrollment:'NOT_INDEPENDENTLY_VERIFIED',
    keyEscrow:'NOT_INDEPENDENTLY_VERIFIED',isolatedRestore:'NOT_TESTED',
    installedRuntimeBytes:'NOT_PROVEN',agentOnlyCanary:'STOP',oauthCanary:'STOP'
  });
}
