import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PAGE_CHARS, MAX_INPUT_CHARS, MAX_TRANSPORT_CHARS,
  pageListProcessesSnapshot, snapshotListProcessesResponse,
} from './p2-bounded-mcp-response.mjs';

const result = text => ({ content: [{ type: 'text', text }] });
const outerTransportText = page => JSON.stringify({ result: page });
const collect = (snapshot, maxPageChars = DEFAULT_PAGE_CHARS) => {
  const pages = [];
  for (let offset = 0;;) {
    const page = pageListProcessesSnapshot(snapshot, { offset, maxPageChars });
    pages.push(page);
    if (page.next === null) return pages;
    offset = page.next.offset;
  }
};

test('small response has a versioned partial envelope and exact reconstruction', () => {
  const text = 'pid\tcommand\r\n42\t工具 🚀\\"\r\n\r\n';
  const snapshot = snapshotListProcessesResponse(result(text));
  const pages = collect(snapshot, 7);
  assert.equal(pages.map(page => page.text).join(''), text);
  assert.equal(pages.at(-1).next, null);
  assert.equal(pages[0].partial, true);
  assert.equal(pages[0].snapshotId, snapshot.snapshotId);
  assert.ok(pages.every(page => outerTransportText(page).length < MAX_TRANSPORT_CHARS));
  assert.ok(pages.every(page => Buffer.byteLength(outerTransportText(page), 'utf8') < MAX_TRANSPORT_CHARS));
});

test('107432-character process-like text is paged without echoing the input in metadata', () => {
  const text = Array.from({ length: 107432 }, (_, index) => `${index}\t/Applications/Test.app\n`).join('').slice(0, 107432);
  const snapshot = snapshotListProcessesResponse(result(text));
  const pages = collect(snapshot, 16000);
  assert.equal(pages.map(page => page.text).join(''), text);
  assert.equal(snapshot.total, text.length);
  assert.ok(pages.every(page => !JSON.stringify(page).includes('P2_MCP')));
});

test('UTF-8 byte pressure reduces an emoji page while preserving surrogate pairs', () => {
  const text = '中文🚀'.repeat(12000);
  const snapshot = snapshotListProcessesResponse(result(text));
  const pages = collect(snapshot, 24000);
  assert.equal(pages.map(page => page.text).join(''), text);
  assert.ok(pages.every(page => page.text.length <= 24000));
  assert.ok(pages.every(page => outerTransportText(page).length < MAX_TRANSPORT_CHARS));
  assert.ok(pages.every(page => Buffer.byteLength(outerTransportText(page), 'utf8') < MAX_TRANSPORT_CHARS));
});

test('Chinese repetition stays below the full result transport envelope bound', () => {
  const snapshot = snapshotListProcessesResponse(result('中'.repeat(30000)));
  const pages = collect(snapshot, 24000);
  assert.ok(pages.some(page => page.text.length < 24000));
  for (const page of pages) {
    const outer = outerTransportText(page);
    assert.ok(outer.length < MAX_TRANSPORT_CHARS);
    assert.ok(Buffer.byteLength(outer, 'utf8') < MAX_TRANSPORT_CHARS);
  }
});

test('exact page boundary and blank tail are preserved', () => {
  const text = 'x'.repeat(100) + '\r\n\r\n';
  const snapshot = snapshotListProcessesResponse(result(text));
  const pages = collect(snapshot, 100);
  assert.equal(pages[0].text, 'x'.repeat(100));
  assert.equal(pages[1].text, '\r\n\r\n');
  assert.equal(pages.map(page => page.text).join(''), text);
});

test('malformed, error, NUL, lone surrogate, and oversized input fail closed without echo', () => {
  const cases = [
    [{ content: [] }, 'P2_MCP_RESPONSE_UNSUPPORTED'],
    [{ content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }, 'P2_MCP_RESPONSE_UNSUPPORTED'],
    [{ content: [{ type: 'image', data: 'secret' }] }, 'P2_MCP_RESPONSE_UNSUPPORTED'],
    [{ isError: true, content: [{ type: 'text', text: 'secret' }] }, 'P2_MCP_RESPONSE_UNSUPPORTED'],
    [result('a\0secret'), 'P2_MCP_RESPONSE_INVALID'],
    [result('\uD800secret'), 'P2_MCP_RESPONSE_INVALID'],
    [result('x'.repeat(MAX_INPUT_CHARS + 1)), 'P2_MCP_RESPONSE_INVALID'],
  ];
  for (const [input, code] of cases) assert.throws(() => snapshotListProcessesResponse(input), { code });
});

test('tampered snapshots and invalid offsets/limits are rejected', () => {
  const snapshot = snapshotListProcessesResponse(result('ab🚀cdef'));
  const sameContentSnapshot = snapshotListProcessesResponse(result('ab🚀cdef'));
  assert.equal(sameContentSnapshot.snapshotId, snapshot.snapshotId);
  assert.throws(() => pageListProcessesSnapshot({ ...snapshot }), { code: 'P2_MCP_SNAPSHOT_INVALID' });
  assert.throws(() => pageListProcessesSnapshot(snapshot, { offset: 3 }), { code: 'P2_MCP_OFFSET_INVALID' });
  assert.throws(() => pageListProcessesSnapshot(snapshot, { offset: -1 }), { code: 'P2_MCP_OFFSET_INVALID' });
  assert.throws(() => pageListProcessesSnapshot(snapshot, { maxPageChars: 0 }), { code: 'P2_MCP_PAGE_LIMIT_INVALID' });
  assert.throws(() => pageListProcessesSnapshot(snapshot, { maxPageChars: 24577 }), { code: 'P2_MCP_PAGE_LIMIT_INVALID' });
  assert.throws(() => pageListProcessesSnapshot(snapshot, null), { code: 'P2_MCP_REQUEST_INVALID' });
});

test('structured content and metadata are rejected instead of being discarded', () => {
  for (const key of ['structuredContent', '_meta']) {
    assert.throws(() => snapshotListProcessesResponse({ ...result('text'), [key]: {} }), {
      code: 'P2_MCP_RESPONSE_UNSUPPORTED',
    });
  }
});

test('unauthorized or non-result contexts are never interpreted as process responses', () => {
  for (const input of [null, 'text', { result: result('secret') }, { content: [{ type: 'text', text: 'secret' }], deviceId: 'other' }])
    assert.throws(() => snapshotListProcessesResponse(input), /P2_MCP_RESPONSE_/);
});
