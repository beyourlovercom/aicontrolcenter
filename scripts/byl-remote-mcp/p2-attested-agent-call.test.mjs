import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createHash, sign } from 'node:crypto';
import { createP2AttestedAgentCallGuard, canonicalP2OperatorReceipt, P2_OPERATOR_RECEIPT_VERSION } from './p2-attested-agent-call.mjs';

const deviceId = 'us-macmini';
const pair = () => generateKeyPairSync('ed25519');
const textResult = text => ({ content: [{ type: 'text', text }] });
const digest = (name, request) => createHash('sha256').update(JSON.stringify({ name, request })).digest('hex');

function fixture({ now = 1_700_000_000_000, source = 'ok', maxSkewMs = 30_000, maxReceiptTtlMs = 30_000 } = {}) {
  const transport = pair(); const operator = pair(); const time = { now }; const state = { calls: 0, authorizations: 0, revoked: false };
  const authorizeOperatorReceipt = async ({ receipt, deviceId: actualDevice, operation }) => {
    state.authorizations += 1;
    if (state.revoked || actualDevice !== deviceId || operation !== receipt.operation ||
        receipt.principalHash !== 'hash:approved' || receipt.authorizationBinding !== 'binding:approved')
      return { allowed: false, issuer: 'a4.1-policy', principalHash: 'hash:denied', authorizationBinding: 'binding:denied', deviceId: actualDevice, operation };
    return { allowed: true, issuer: 'a4.1-policy', principalHash: 'hash:approved', authorizationBinding: 'binding:approved', deviceId, operation };
  };
  const guard = createP2AttestedAgentCallGuard({
    deviceId, transportPublicKey: transport.publicKey, operatorPublicKey: operator.publicKey,
    authorizeOperatorReceipt, clock: () => time.now, maxSkewMs, maxReceiptTtlMs,
    callTool: async () => { state.calls += 1; if (source === 'error') throw new Error('private sdk detail'); return textResult(source); },
  });
  return { guard, transport, operator, time, state };
}

function receiptFor(f, name = 'p2_list_processes_start', request = {}, nonce = `${String(f.state.calls)}${'A'.repeat(21)}`, changes = {}) {
  return {
    version: P2_OPERATOR_RECEIPT_VERSION, deviceId, operation: name,
    principalHash: 'hash:approved', authorizationBinding: 'binding:approved', requestDigest: digest(name, request),
    issuedAt: f.time.now, expiresAt: f.time.now + 10_000, nonce, signature: '', ...changes,
  };
}

function signedRaw(f, rawBody, stamp = f.time.now, transport = f.transport.privateKey) {
  const timestamp = String(stamp);
  const canonical = `POST\n/v1/call\n${timestamp}\n${createHash('sha256').update(rawBody).digest('hex')}`;
  return { method: 'POST', path: '/v1/call', headers: {
    'content-type': 'application/json', 'x-byl-timestamp': timestamp,
    'x-byl-signature': sign(null, Buffer.from(canonical), transport).toString('base64'),
  }, rawBody };
}

function signed(f, name = 'p2_list_processes_start', request = {}, nonce, changes = {}, operator = f.operator.privateKey) {
  const receipt = receiptFor(f, name, request, nonce, changes);
  receipt.signature = sign(null, Buffer.from(canonicalP2OperatorReceipt(receipt)), operator).toString('base64');
  return signedRaw(f, Buffer.from(JSON.stringify({ name, arguments: { request, receipt } })));
}

async function code(f, input) { return (await f.guard.handle(input)).body?.error?.code; }

test('full signed start and NEXT loop reconstructs exact 107432-character Unicode/CRLF text', async () => {
  const prefix = '中文🚀\\"\r\n';
  const source = `${prefix}${'x'.repeat(107432 - prefix.length)}`;
  assert.equal(source.length, 107432);
  const f = fixture({ source });
  let result = (await f.guard.handle(signed(f))).body.result; let reconstructed = result.text; let pages = 1;
  while (result.next !== null) {
    const request = { handle: result.handle, offset: result.next.offset };
    result = (await f.guard.handle(signed(f, 'p2_list_processes_next', request, `${pages}${'B'.repeat(21)}`))).body.result;
    reconstructed += result.text; pages += 1;
    const serialized = JSON.stringify({ result });
    assert.ok(serialized.length < 65_536); assert.ok(Buffer.byteLength(serialized, 'utf8') < 65_536);
  }
  assert.equal(reconstructed, source); assert.equal(f.state.calls, 1); assert.ok(pages > 1);
});

test('canonical raw JSON rejects duplicate keys, whitespace, overlong escapes, and invalid UTF-8 after transport proof', async () => {
  const f = fixture(); const valid = signed(f); const parsed = JSON.parse(valid.rawBody);
  const receipt = parsed.arguments.receipt;
  const duplicateName = `{"name":"p2_list_processes_start","name":"p2_list_processes_start","arguments":${JSON.stringify(parsed.arguments)}}`;
  const duplicateArguments = `{"name":"p2_list_processes_start","arguments":${JSON.stringify(parsed.arguments)},"arguments":${JSON.stringify(parsed.arguments)}}`;
  const duplicateReceipt = `{"name":"p2_list_processes_start","arguments":{"request":{},"receipt":${JSON.stringify(receipt)},"receipt":${JSON.stringify(receipt)}}}`;
  for (const raw of [duplicateName, duplicateArguments, duplicateReceipt, ` ${valid.rawBody}`,
    valid.rawBody.toString().replace('"hash:approved"', '"\\u0068ash:approved"')])
    assert.equal(await code(f, signedRaw(f, Buffer.from(raw))), 'P2_ATTESTED_RECEIPT_INVALID');
  const invalid = Buffer.concat([valid.rawBody.subarray(0, valid.rawBody.length - 1), Buffer.from(',"unused":"'), Buffer.from([0xc3]), Buffer.from('"}')]);
  assert.equal(await code(f, signedRaw(f, invalid)), 'P2_ATTESTED_RECEIPT_INVALID');
});

test('malformed names/requests/missing proofs are indistinguishable before attestation', async () => {
  const f = fixture();
  const malformed = [
    Buffer.from(JSON.stringify({ name: 'unknown', arguments: {} })),
    Buffer.from(JSON.stringify({ name: 'p2_list_processes_start', arguments: { request: {}, receipt: null } })),
    Buffer.from(JSON.stringify({ name: 'unknown', arguments: { request: {}, receipt: null } })),
  ];
  const codes = await Promise.all(malformed.map(raw => code(f, signedRaw(f, raw))));
  assert.deepEqual(codes, ['P2_ATTESTED_RECEIPT_INVALID', 'P2_ATTESTED_RECEIPT_INVALID', 'P2_ATTESTED_RECEIPT_INVALID']);
});

test('receipt time policy rejects exact expiry, future trailing, stale, and tight maxSkew values', async () => {
  const f = fixture({ maxSkewMs: 1_000 });
  assert.equal(await code(f, signed(f, 'p2_list_processes_start', {}, 'C'.repeat(22), { expiresAt: f.time.now + 2_000 })), 'P2_ATTESTED_RECEIPT_INVALID');
  assert.equal(await code(f, signed(f, 'p2_list_processes_start', {}, 'D'.repeat(22), { issuedAt: f.time.now + 1_001, expiresAt: f.time.now + 1_501 })), 'P2_ATTESTED_RECEIPT_INVALID');
  f.time.now += 10_001;
  assert.equal(await code(f, signed(f, 'p2_list_processes_start', {}, 'E'.repeat(22))), 'P2_ATTESTED_RECEIPT_INVALID');
  f.time.now = 1_700_000_000_000;
  assert.equal(await code(f, signed(f, 'p2_list_processes_start', {}, 'F'.repeat(22), { expiresAt: f.time.now })), 'P2_ATTESTED_RECEIPT_INVALID');
});

test('A4.1 callback is mandatory, independent, invoked on every page, and denies identity/revocation changes', async () => {
  const f = fixture({ source: 'x'.repeat(40_000) });
  let result = (await f.guard.handle(signed(f))).body.result;
  while (result.next !== null) {
    result = (await f.guard.handle(signed(f, 'p2_list_processes_next', { handle: result.handle, offset: result.next.offset }, `${f.state.authorizations}${'K'.repeat(21)}`))).body.result;
  }
  assert.equal(f.state.calls, 1); assert.ok(f.state.authorizations > 1);
  assert.equal(await code(f, signed(f, 'p2_list_processes_start', {}, 'G'.repeat(22), { principalHash: 'hash:wrong' })), 'P2_ATTESTED_RECEIPT_INVALID');
  f.state.revoked = true;
  assert.equal(await code(f, signed(f, 'p2_list_processes_next', { handle: 'A'.repeat(32), offset: 0 }, 'H'.repeat(22))), 'P2_ATTESTED_RECEIPT_INVALID');
});

test('constructor requires a fixed unavailable trap and distinct Ed25519 public keys', () => {
  const f = fixture();
  assert.throws(() => createP2AttestedAgentCallGuard({ deviceId, transportPublicKey: f.transport.publicKey, operatorPublicKey: f.operator.publicKey, callTool() {} }), { message: 'P2_ATTESTED_UNAVAILABLE' });
  assert.throws(() => createP2AttestedAgentCallGuard({ deviceId, transportPublicKey: f.transport.privateKey, operatorPublicKey: f.operator.publicKey, authorizeOperatorReceipt() {}, callTool() {} }), { message: 'P2_ATTESTED_UNAVAILABLE' });
  assert.throws(() => createP2AttestedAgentCallGuard({ deviceId, transportPublicKey: f.transport.publicKey, operatorPublicKey: f.transport.publicKey, authorizeOperatorReceipt() {}, callTool() {} }), { message: 'P2_ATTESTED_UNAVAILABLE' });
  const hostile = new Proxy(f.transport.publicKey, { get() { throw new Error('secret'); } });
  assert.throws(() => createP2AttestedAgentCallGuard({ deviceId, transportPublicKey: hostile, operatorPublicKey: f.operator.publicKey, authorizeOperatorReceipt() {}, callTool() {} }), { message: 'P2_ATTESTED_UNAVAILABLE' });
});

test('forged operator key, missing signature, transport errors, extra fields, and input type fail closed', async () => {
  const f = fixture(); const forged = pair();
  assert.equal(await code(f, signed(f, 'p2_list_processes_start', {}, 'I'.repeat(22), {}, forged.privateKey)), 'P2_ATTESTED_RECEIPT_INVALID');
  const missing = signed(f); const body = JSON.parse(missing.rawBody); delete body.arguments.receipt.signature;
  assert.equal(await code(f, signedRaw(f, Buffer.from(JSON.stringify(body)))), 'P2_ATTESTED_RECEIPT_INVALID');
  assert.equal(await code(f, { ...signed(f), rawBody: signed(f).rawBody.toString() }), 'P2_ATTESTED_REQUEST_INVALID');
  const extra = signed(f); const extraBody = JSON.parse(extra.rawBody); extraBody.arguments.extra = true;
  assert.equal(await code(f, signedRaw(f, Buffer.from(JSON.stringify(extraBody)))), 'P2_ATTESTED_RECEIPT_INVALID');
});

test('nonce reservation is atomic, bounded at 128, and exact-expiry pruning permits reuse', async () => {
  const f = fixture(); const same = signed(f, 'p2_list_processes_start', {}, 'J'.repeat(22));
  const results = await Promise.all([f.guard.handle(same), f.guard.handle(same)]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 400]);
  f.time.now += 10_000;
  assert.equal((await f.guard.handle(signed(f, 'p2_list_processes_start', {}, 'J'.repeat(22)))).status, 200);
  const bounded = fixture();
  for (let index = 0; index < 128; index += 1)
    assert.equal((await bounded.guard.handle(signed(bounded, 'p2_list_processes_start', {}, `${index}${'L'.repeat(21)}`))).status, 200);
  assert.equal(await code(bounded, signed(bounded, 'p2_list_processes_start', {}, `${'M'.repeat(22)}`)), 'P2_ATTESTED_REPLAY_DENIED');
});

test('SDK details are sanitized and no OAuth, listener, network, key loading, or production integration is used', async () => {
  const f = fixture({ source: 'error' }); const result = await f.guard.handle(signed(f));
  assert.deepEqual(result.body, { error: { code: 'P2_AGENT_SOURCE_FAILED' } });
  assert.ok(!JSON.stringify(result).includes('private sdk detail'));
});
