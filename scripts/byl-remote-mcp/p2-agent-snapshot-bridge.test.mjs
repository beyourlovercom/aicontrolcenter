import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createP2AgentSnapshotBridge,
  MAX_SESSIONS,
  MAX_SNAPSHOT_CHARS,
  OUTER_TRANSPORT_RESERVE,
} from './p2-agent-snapshot-bridge.mjs';

const textResult = text => ({ content: [{ type: 'text', text }] });
const context = Object.freeze({ signed: true, requestId: 'synthetic' });
const make = (text = 'pid\tcommand\r\n1\t工具 🚀\\"\r\n\r\n', extra = {}) => {
  let now = 1_000;
  let calls = 0;
  const authorized = extra.authorized ?? true;
  const bridge = createP2AgentSnapshotBridge({
    callTool: () => { calls += 1; if (extra.sourceError) throw new Error('private detail'); return textResult(text); },
    authorize: ({ requestContext }) => authorized && requestContext === context ? {
      allowed: true, principal: 'server:operator', deviceId: extra.deviceId ?? 'us-macmini',
      provenance: 'server-verified', authorizationBinding: 'binding:operator',
    } : null,
    clock: { now: () => now },
    ttlMs: extra.ttlMs ?? 30_000,
    maxPageChars: extra.maxPageChars ?? 16_384,
  });
  return { bridge, calls: () => calls, advance: ms => { now += ms; } };
};
const start = fixture => fixture.bridge.request('p2_list_processes_start', {}, context);
const next = (fixture, response) => fixture.bridge.request('p2_list_processes_next', { handle: response.result.handle, offset: response.result.next.offset }, context);

test('107432 characters reconstruct exactly and source is called once', async () => {
  const source = Array.from({ length: 107432 }, (_, i) => `${i}\t/Applications/Test.app\n`).join('').slice(0, 107432);
  const f = make(source, { maxPageChars: 16_000 });
  const first = await start(f); const pages = [first.result];
  while (pages.at(-1).next) pages.push((await next(f, { result: pages.at(-1) })).result);
  assert.equal(pages.map(p => p.text).join(''), source);
  assert.equal(f.calls(), 1);
});

test('Chinese, emoji, quotes, backslashes, CRLF, and final blanks survive', async () => {
  const source = '中文🚀\\"\r\n\r\n'.repeat(5000);
  const f = make(source, { maxPageChars: 24_576 }); let response = await start(f); const pages = [response.result];
  while (pages.at(-1).next) response = await next(f, response), pages.push(response.result);
  assert.equal(pages.map(p => p.text).join(''), source);
  assert.ok(pages.every(p => { const s = JSON.stringify({ result: p }); return s.length < 65536 && Buffer.byteLength(s) < 65536; }));
});

test('handle-inclusive envelope stays below both limits under byte and character pressure', async () => {
  const f = make('中'.repeat(30_000), { maxPageChars: 24_576 });
  const response = await start(f); const serialized = JSON.stringify(response);
  assert.ok(serialized.length < 65536 - OUTER_TRANSPORT_RESERVE);
  assert.ok(Buffer.byteLength(serialized) < 65536 - OUTER_TRANSPORT_RESERVE);
  assert.ok(response.result.text.length < 24_576);
});

test('opaque crypto handles are patterned and distinct without injection override', async () => {
  const f = make('same'); const [a, b] = await Promise.all([start(f), start(f)]);
  assert.match(a.result.handle, /^[A-Za-z0-9_-]{32,128}$/u);
  assert.match(b.result.handle, /^[A-Za-z0-9_-]{32,128}$/u);
  assert.notEqual(a.result.handle, b.result.handle); assert.equal(f.calls(), 2);
});

test('malformed start/next requests do not call source or write sessions', async () => {
  const f = make();
  assert.equal((await f.bridge.request('p2_list_processes_start', { client: 'device' }, context)).error.code, 'P2_AGENT_REQUEST_INVALID');
  assert.equal((await f.bridge.request('p2_list_processes_next', { handle: 'bad', offset: 0 }, context)).error.code, 'P2_AGENT_REQUEST_INVALID');
  assert.equal(f.calls(), 0);
});

test('missing policy, bad context, and unauthorized request fail closed', async () => {
  const f = make('secret', { authorized: false });
  assert.equal((await f.bridge.request('p2_list_processes_start', {}, context)).error.code, 'P2_AGENT_UNAUTHORIZED');
  assert.equal((await f.bridge.request('p2_list_processes_start', {}, null)).error.code, 'P2_AGENT_UNAUTHORIZED');
  assert.equal(f.calls(), 0);
});

test('async authorization is awaited and rejected policy never delegates or leaks', async () => {
  let calls = 0;
  const bridge = createP2AgentSnapshotBridge({
    authorize: async () => { throw new Error('private policy detail'); },
    callTool: async () => { calls += 1; return textResult('must not run'); },
  });
  const result = await bridge.request('p2_list_processes_start', {}, context);
  assert.deepEqual(result, { error: { code: 'P2_AGENT_UNAUTHORIZED' } });
  assert.equal(calls, 0);
});

test('fulfilled SDK callTool Promise is awaited and rejected Promise is sanitized', async () => {
  let calls = 0;
  const fulfilled = createP2AgentSnapshotBridge({
    authorize: async () => ({ allowed: true, principal: 'server:async', deviceId: 'us-macmini', provenance: 'server-verified', authorizationBinding: 'binding:async' }),
    callTool: async () => { calls += 1; return textResult('async source'); },
  });
  const response = await fulfilled.request('p2_list_processes_start', {}, context);
  assert.equal(response.result.text, 'async source');
  assert.equal(calls, 1);

  const rejected = createP2AgentSnapshotBridge({
    authorize: () => ({ allowed: true, principal: 'server:async', deviceId: 'us-macmini', provenance: 'server-verified', authorizationBinding: 'binding:async' }),
    callTool: () => Promise.reject(Object.assign(new Error('private SDK detail'), { code: 'P2_MCP_RESPONSE_UNSUPPORTED' })),
  });
  const error = await rejected.request('p2_list_processes_start', {}, context);
  assert.deepEqual(error, { error: { code: 'P2_AGENT_SOURCE_UNSUPPORTED' } });
  assert.ok(!JSON.stringify(error).includes('private SDK detail'));
});

test('hostile and primitive SDK failures never reject request or leak exception properties', async () => {
  const authorize = () => ({ allowed: true, principal: 'server:hostile', deviceId: 'us-macmini', provenance: 'server-verified', authorizationBinding: 'binding:hostile' });
  const hostileTarget = {};
  const hostile = new Proxy(hostileTarget, { get(target, property) {
    if (property === 'code' || property === 'message') throw new Error('getter trap');
    return Reflect.get(target, property);
  } });
  hostileTarget.self = hostile;
  const cases = [
    () => Promise.reject(hostile),
    () => Promise.reject({ get message() { throw new Error('message trap'); } }),
    () => Promise.reject('primitive rejection'),
    () => { throw hostile; },
  ];
  for (const callTool of cases) {
    const bridge = createP2AgentSnapshotBridge({ authorize, callTool });
    const result = await bridge.request('p2_list_processes_start', {}, context);
    assert.deepEqual(result, { error: { code: 'P2_AGENT_SOURCE_FAILED' } });
  }
});

test('identity and device mismatch deny snapshot retrieval before paging', async () => {
  let mode = 'original';
  const f = createP2AgentSnapshotBridge({
    callTool: () => textResult('abcdef'),
    authorize: () => mode === 'original' ? { allowed: true, principal: 'server:a', deviceId: 'us-macmini', provenance: 'server-verified', authorizationBinding: 'binding:a' } : { allowed: true, principal: 'server:b', deviceId: 'china-mac', provenance: 'server-verified', authorizationBinding: 'binding:b' },
    maxPageChars: 2,
  });
  const response = await f.request('p2_list_processes_start', {}, context); mode = 'changed';
  const mismatched = await f.request('p2_list_processes_next', { handle: response.result.handle, offset: response.result.next.offset }, context);
  assert.equal(mismatched.error.code, 'P2_AGENT_SNAPSHOT_MISMATCH');
});

test('device binding rejects a different canonical device', async () => {
  const f = make('a', { deviceId: 'china-mac' }); const response = await start(f);
  const other = createP2AgentSnapshotBridge({ callTool: () => textResult('never'), authorize: () => ({ allowed: true, principal: 'server:operator', deviceId: 'us-macmini', provenance: 'server-verified', authorizationBinding: 'binding:operator' }) });
  assert.equal((await other.request('p2_list_processes_next', { handle: response.result.handle, offset: 0 }, context)).error.code, 'P2_AGENT_HANDLE_INVALID');
});

test('stale and early-expired handles are denied and cannot replay', async () => {
  const f = make('abcdef', { ttlMs: 10, maxPageChars: 2 }); const response = await start(f); f.advance(10);
  assert.equal((await f.bridge.request('p2_list_processes_next', { handle: response.result.handle, offset: 0 }, context)).error.code, 'P2_AGENT_SNAPSHOT_EXPIRED');
  assert.equal((await f.bridge.request('p2_list_processes_next', { handle: response.result.handle, offset: 0 }, context)).error.code, 'P2_AGENT_HANDLE_INVALID');
});

test('early next, wrong offset, and last-page replay are denied', async () => {
  const f = make('abcdef', { maxPageChars: 2 }); const first = await start(f);
  assert.equal((await f.bridge.request('p2_list_processes_next', { handle: first.result.handle, offset: 0 }, context)).error.code, 'P2_AGENT_REQUEST_INVALID');
  let response = await next(f, first); while (response.result.next) response = await next(f, response);
  assert.equal((await f.bridge.request('p2_list_processes_next', { handle: response.result.handle, offset: response.result.end }, context)).error.code, 'P2_AGENT_HANDLE_INVALID');
});

test('zero-length source returns one terminal page and no continuation session', async () => {
  const f = make(''); const response = await start(f);
  assert.equal(response.result.next, null);
  assert.equal((await f.bridge.request('p2_list_processes_next', { handle: response.result.handle, offset: 0 }, context)).error.code, 'P2_AGENT_HANDLE_INVALID');
});

test('source errors are sanitized and never expose exception text', async () => {
  const f = make('secret', { sourceError: true }); const result = await start(f);
  assert.deepEqual(result, { error: { code: 'P2_AGENT_SOURCE_FAILED' } });
  assert.ok(!JSON.stringify(result).includes('private detail'));
});

test('unsupported metadata and non-text content fail closed', async () => {
  for (const bad of [
    { content: [{ type: 'image', data: 'raw' }] },
    { content: [{ type: 'text', text: 'x' }], _meta: { raw: true } },
  ]) {
    const custom = createP2AgentSnapshotBridge({ callTool: () => bad, authorize: () => ({ allowed: true, principal: 'server:x', deviceId: 'windows', provenance: 'server-verified', authorizationBinding: 'binding:x' }) });
    assert.equal((await custom.request('p2_list_processes_start', {}, context)).error.code, 'P2_AGENT_SOURCE_UNSUPPORTED');
  }
});

test('eight-session quota evicts oldest and preserves newer snapshots', async () => {
  const f = make('snapshot', { maxPageChars: 2 }); const responses = [];
  for (let i = 0; i < MAX_SESSIONS + 1; i += 1) responses.push(await start(f));
  assert.equal((await f.bridge.request('p2_list_processes_next', { handle: responses[0].result.handle, offset: responses[0].result.next.offset }, context)).error.code, 'P2_AGENT_HANDLE_INVALID');
  assert.notEqual((await f.bridge.request('p2_list_processes_next', { handle: responses.at(-1).result.handle, offset: responses.at(-1).result.next.offset }, context)).error?.code, 'P2_AGENT_HANDLE_INVALID');
});

test('oversized snapshots are rejected before a session is retained', async () => {
  const f = make('x'.repeat(MAX_SNAPSHOT_CHARS + 1));
  assert.equal((await start(f)).error.code, 'P2_AGENT_SOURCE_FAILED');
});

test('fixed canonical devices are enforced by the bridge', async () => {
  const f = make('x', { deviceId: 'not-a-device' });
  assert.equal((await start(f)).error.code, 'P2_AGENT_UNAUTHORIZED');
});

test('authorization requires trusted server verification and stable binding', async () => {
  for (const decision of [
    { allowed: false, principal: 'server:x', deviceId: 'us-macmini', provenance: 'server-verified', authorizationBinding: 'binding:x' },
    { allowed: true, principal: 'server:x', deviceId: 'us-macmini', provenance: 'client-claimed', authorizationBinding: 'binding:x' },
    { allowed: true, principal: 'server:x', deviceId: 'us-macmini', provenance: 'server-verified', authorizationBinding: '' },
    { allowed: true, principal: 'server:x', deviceId: 'us-macmini', provenance: 'server-verified' },
  ]) {
    const bridge = createP2AgentSnapshotBridge({ callTool: () => textResult('must not run'), authorize: () => decision });
    assert.equal((await bridge.request('p2_list_processes_start', {}, { allowed: true, principal: 'client:fake' })).error.code, 'P2_AGENT_UNAUTHORIZED');
  }
});

test('authorization binding is checked again before snapshot retrieval', async () => {
  let binding = 'binding:one';
  const f = createP2AgentSnapshotBridge({
    callTool: () => textResult('abcdef'),
    authorize: () => ({ allowed: true, principal: 'server:a', deviceId: 'us-macmini', provenance: 'server-verified', authorizationBinding: binding }),
    maxPageChars: 2,
  });
  const response = await f.request('p2_list_processes_start', {}, context);
  binding = 'binding:two';
  assert.equal((await f.request('p2_list_processes_next', { handle: response.result.handle, offset: response.result.next.offset }, context)).error.code, 'P2_AGENT_SNAPSHOT_MISMATCH');
});

test('nine pending source calls never exceed eight reservations and rejection releases one', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let calls = 0;
  const bridge = createP2AgentSnapshotBridge({
    authorize: () => ({ allowed: true, principal: 'server:pending', deviceId: 'us-macmini', provenance: 'server-verified', authorizationBinding: 'binding:pending' }),
    callTool: async () => { calls += 1; await gate; return textResult('pending'); },
  });
  const pending = Array.from({ length: MAX_SESSIONS + 1 }, () => bridge.request('p2_list_processes_start', {}, context));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, MAX_SESSIONS);
  assert.equal((await pending.at(-1)).error.code, 'P2_AGENT_UNAVAILABLE');
  release();
  const results = await Promise.all(pending.slice(0, -1));
  assert.equal(results.length, MAX_SESSIONS);

  const rejected = createP2AgentSnapshotBridge({
    authorize: () => ({ allowed: true, principal: 'server:reject', deviceId: 'us-macmini', provenance: 'server-verified', authorizationBinding: 'binding:reject' }),
    callTool: () => Promise.reject(new Error('sdk failure')),
  });
  assert.equal((await rejected.request('p2_list_processes_start', {}, context)).error.code, 'P2_AGENT_SOURCE_FAILED');
  assert.equal((await rejected.request('p2_list_processes_start', {}, context)).error.code, 'P2_AGENT_SOURCE_FAILED');
});

test('signed integration caller prerequisite is represented by injected context only', async () => {
  const f = make('signed'); const response = await f.bridge.request('p2_list_processes_start', {}, context);
  assert.equal(response.result.text, 'signed');
  assert.equal(f.calls(), 1);
});
