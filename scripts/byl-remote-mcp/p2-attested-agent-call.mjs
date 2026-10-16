import {
  createHash,
  verify,
  timingSafeEqual,
  KeyObject,
} from 'node:crypto';
import { createP2AgentSnapshotBridge, CANONICAL_DEVICE_IDS } from './p2-agent-snapshot-bridge.mjs';

export const P2_ATTESTED_AGENT_CALL_VERSION = 'aicc-p2-attested-agent-call/v1';
export const P2_OPERATOR_RECEIPT_VERSION = 'aicc-p2-operator-receipt/v1';
export const P2_OPERATOR_RECEIPT_DOMAIN = 'AICC-P2-AUTHZ-V1\n';
export const P2_ATTESTED_MAX_BODY_BYTES = 8192;
export const P2_ATTESTED_MAX_SKEW_MS = 30_000;
export const P2_ATTESTED_MAX_NONCES = 128;

const MAX_OUTGOING = 65_536 - 1_024;
const TOOLS = new Set(['p2_list_processes_start', 'p2_list_processes_next']);
const RECEIPT_FIELDS = Object.freeze([
  'version', 'deviceId', 'operation', 'principalHash', 'authorizationBinding',
  'requestDigest', 'issuedAt', 'expiresAt', 'nonce',
]);
const SAFE_OPAQUE = /^[A-Za-z0-9._:-]{1,256}$/u;
const NONCE = /^[A-Za-z0-9_-]{22,64}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;

const ERR = Object.freeze({
  request: 'P2_ATTESTED_REQUEST_INVALID', signature: 'P2_ATTESTED_SIGNATURE_INVALID',
  receipt: 'P2_ATTESTED_RECEIPT_INVALID', replay: 'P2_ATTESTED_REPLAY_DENIED',
  unavailable: 'P2_ATTESTED_UNAVAILABLE', response: 'P2_ATTESTED_RESPONSE_LIMIT',
});

function errorBody(code) { return Object.freeze({ error: Object.freeze({ code }) }); }
function response(status, body) { return Object.freeze({ status, body }); }
function fail(code) { return response(400, errorBody(code)); }
function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}
function exactKeys(value, keys) {
  if (!plainObject(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
}
function strictBase64(value) {
  if (typeof value !== 'string' || value.length === 0 || !BASE64.test(value)) return null;
  try {
    const bytes = Buffer.from(value, 'base64');
    if (bytes.length === 0 || bytes.toString('base64') !== value) return null;
    return bytes;
  } catch { return null; }
}
function publicEd25519(value) {
  try {
    return value instanceof KeyObject && value.type === 'public' && value.asymmetricKeyType === 'ed25519';
  } catch {
    throw new Error(ERR.unavailable);
  }
}
function samePublicKey(a, b) {
  try {
    const x = a.export({ type: 'spki', format: 'der' });
    const y = b.export({ type: 'spki', format: 'der' });
    return x.length === y.length && timingSafeEqual(x, y);
  } catch { throw new Error(ERR.unavailable); }
}
function safeMs(value) { return Number.isSafeInteger(value) && /^[0-9]{13}$/u.test(String(value)); }
function digestRequest(name, request) {
  return createHash('sha256').update(JSON.stringify({ name, request }), 'utf8').digest('hex');
}

// This is the exact byte sequence signed by the independent A4.1 receipt issuer.
// JSON.stringify preserves the explicitly listed insertion order and excludes signature.
export function canonicalP2OperatorReceipt(receipt) {
  if (!plainObject(receipt) || !RECEIPT_FIELDS.every(field => Object.hasOwn(receipt, field))) return null;
  const ordered = Object.create(null);
  for (const field of RECEIPT_FIELDS) ordered[field] = receipt[field];
  return P2_OPERATOR_RECEIPT_DOMAIN + JSON.stringify(ordered);
}

function validHeaders(headers) {
  if (!plainObject(headers)) return false;
  const contentType = headers['content-type'] ?? headers['Content-Type'];
  return typeof contentType === 'string' && contentType.toLowerCase() === 'application/json';
}
function header(headers, name) {
  const value = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
  return typeof value === 'string' ? value : null;
}
function validRequest(name, request) {
  if (!TOOLS.has(name) || !plainObject(request)) return false;
  if (name === 'p2_list_processes_start') return exactKeys(request, []);
  return exactKeys(request, ['handle', 'offset']) && typeof request.handle === 'string' &&
    /^[A-Za-z0-9_-]{32,128}$/u.test(request.handle) && Number.isSafeInteger(request.offset) && request.offset >= 0;
}
function validReceipt(receipt, name, request, deviceId, operatorKey, now, maxSkewMs, maxReceiptTtlMs) {
  if (!exactKeys(receipt, [...RECEIPT_FIELDS, 'signature']) ||
      receipt.version !== P2_OPERATOR_RECEIPT_VERSION || receipt.deviceId !== deviceId ||
      receipt.operation !== name || typeof receipt.principalHash !== 'string' || !SAFE_OPAQUE.test(receipt.principalHash) ||
      typeof receipt.authorizationBinding !== 'string' || !SAFE_OPAQUE.test(receipt.authorizationBinding) ||
      receipt.requestDigest !== digestRequest(name, request) || !safeMs(receipt.issuedAt) || !safeMs(receipt.expiresAt) ||
      receipt.expiresAt <= receipt.issuedAt || receipt.expiresAt - receipt.issuedAt > maxReceiptTtlMs ||
      receipt.issuedAt > now + maxSkewMs || receipt.expiresAt > now + maxSkewMs || receipt.expiresAt <= now ||
      typeof receipt.nonce !== 'string' || !NONCE.test(receipt.nonce)) return false;
  const signature = strictBase64(receipt.signature);
  if (!signature) return false;
  try { return verify(null, Buffer.from(canonicalP2OperatorReceipt(receipt)), operatorKey, signature); } catch { return false; }
}
function outputFits(body) {
  try {
    const serialized = JSON.stringify(body);
    return typeof serialized === 'string' && serialized.length < MAX_OUTGOING && Buffer.byteLength(serialized, 'utf8') < MAX_OUTGOING;
  } catch { return false; }
}

export function createP2AttestedAgentCallGuard(options = {}) {
  let deviceId, transportPublicKey, operatorPublicKey, callTool, authorizeOperatorReceipt;
  let clock, maxSkewMs, maxReceiptTtlMs;
  try {
    ({
      deviceId, transportPublicKey, operatorPublicKey, callTool, authorizeOperatorReceipt,
      clock = Date.now, maxSkewMs = P2_ATTESTED_MAX_SKEW_MS, maxReceiptTtlMs = P2_ATTESTED_MAX_SKEW_MS,
    } = options);
    if (!CANONICAL_DEVICE_IDS.includes(deviceId) || !publicEd25519(transportPublicKey) ||
        !publicEd25519(operatorPublicKey) || samePublicKey(transportPublicKey, operatorPublicKey) ||
        typeof callTool !== 'function' || typeof authorizeOperatorReceipt !== 'function' || typeof clock !== 'function' ||
        !Number.isSafeInteger(maxSkewMs) || maxSkewMs <= 0 || maxSkewMs > P2_ATTESTED_MAX_SKEW_MS ||
        !Number.isSafeInteger(maxReceiptTtlMs) || maxReceiptTtlMs <= 0 || maxReceiptTtlMs > P2_ATTESTED_MAX_SKEW_MS)
      throw new Error(ERR.unavailable);
  } catch { throw new Error(ERR.unavailable); }

  const trustedContexts = new WeakSet();
  const contextIdentity = new WeakMap();
  const nonces = new Map();
  const bridge = createP2AgentSnapshotBridge({
    callTool: args => callTool(args),
    clock: { now: () => clock() },
    authorize: ({ requestContext }) => {
      if (!trustedContexts.has(requestContext)) return null;
      return { allowed: true, provenance: 'server-verified', ...contextIdentity.get(requestContext) };
    },
  });

  async function handle(input) {
    try {
      if (!plainObject(input) || input.method !== 'POST' || input.path !== '/v1/call' ||
          !validHeaders(input.headers) || !Buffer.isBuffer(input.rawBody)) return fail(ERR.request);
      const raw = input.rawBody;
      if (raw.length > P2_ATTESTED_MAX_BODY_BYTES) return fail(ERR.request);
      const stamp = header(input.headers, 'x-byl-timestamp');
      const signature = strictBase64(header(input.headers, 'x-byl-signature'));
      const now = clock();
      if (!/^[0-9]{13}$/u.test(stamp ?? '') || !Number.isSafeInteger(now) || Math.abs(Number(stamp) - now) > maxSkewMs || !signature) return fail(ERR.signature);
      const transportCanonical = `POST\n/v1/call\n${stamp}\n${createHash('sha256').update(raw).digest('hex')}`;
      if (!verify(null, Buffer.from(transportCanonical), transportPublicKey, signature)) return fail(ERR.signature);
      let parsed;
      try {
        const text = raw.toString('utf8');
        if (!Buffer.from(text, 'utf8').equals(raw)) return fail(ERR.receipt);
        parsed = JSON.parse(text);
        if (JSON.stringify(parsed) !== text) return fail(ERR.receipt);
      } catch { return fail(ERR.receipt); }
      if (!exactKeys(parsed, ['name', 'arguments']) || typeof parsed.name !== 'string' ||
          !plainObject(parsed.arguments) || !exactKeys(parsed.arguments, ['request', 'receipt']) ||
          !validRequest(parsed.name, parsed.arguments.request)) return fail(ERR.receipt);
      const receipt = parsed.arguments.receipt;
      const request = parsed.arguments.request;
      if (!validReceipt(receipt, parsed.name, request, deviceId, operatorPublicKey, now, maxSkewMs, maxReceiptTtlMs)) return fail(ERR.receipt);
      let decision;
      try {
        const safeReceipt = Object.freeze(Object.fromEntries(RECEIPT_FIELDS.concat('signature').map(field => [field, receipt[field]])));
        decision = await authorizeOperatorReceipt(Object.freeze({
          receipt: safeReceipt, deviceId, operation: parsed.name, requestDigest: receipt.requestDigest,
        }));
      } catch { return fail(ERR.receipt); }
      if (!plainObject(decision) || !exactKeys(decision, ['allowed', 'issuer', 'principalHash', 'authorizationBinding', 'deviceId', 'operation']) ||
          decision.allowed !== true || decision.issuer !== 'a4.1-policy' || decision.principalHash !== receipt.principalHash ||
          decision.authorizationBinding !== receipt.authorizationBinding || decision.deviceId !== deviceId || decision.operation !== parsed.name)
        return fail(ERR.receipt);
      for (const [nonce, expiresAt] of nonces) if (expiresAt <= now) nonces.delete(nonce);
      if (nonces.size >= P2_ATTESTED_MAX_NONCES) return fail(ERR.replay);
      if (nonces.has(receipt.nonce)) return fail(ERR.replay);
      nonces.set(receipt.nonce, receipt.expiresAt);
      const context = Object.freeze({});
      trustedContexts.add(context);
      contextIdentity.set(context, Object.freeze({ principal: receipt.principalHash, deviceId, authorizationBinding: receipt.authorizationBinding }));
      const body = await bridge.request(parsed.name, request, context);
      return outputFits(body) ? response(200, body) : fail(ERR.response);
    } catch { return fail(ERR.unavailable); }
  }
  return Object.freeze({ handle });
}
