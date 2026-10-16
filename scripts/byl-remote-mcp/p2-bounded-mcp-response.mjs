import { createHash } from 'node:crypto';

export const MAX_TRANSPORT_CHARS = 65536;
export const MAX_INPUT_CHARS = 131072;
export const MAX_PAGE_CHARS = 24576;
export const DEFAULT_PAGE_CHARS = 16384;
export const RESPONSE_VERSION = 'aicc-p2-bounded-mcp-response/v1';

const SNAPSHOT_PAYLOAD = Symbol('p2 snapshot payload');

function fail(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function validString(text) {
  if (typeof text !== 'string' || text.length > MAX_INPUT_CHARS || text.includes('\0')) return false;
  try {
    // A lone surrogate is not a valid UTF-8 text boundary for this contract.
    const roundTrip = Buffer.from(text, 'utf8').toString('utf8');
    return roundTrip === text;
  } catch {
    return false;
  }
}

function validBoundary(text, offset) {
  return offset === 0 || offset === text.length ||
    !(offset > 0 && offset < text.length &&
      /[\uDC00-\uDFFF]/u.test(text[offset]) && /[\uD800-\uDBFF]/u.test(text[offset - 1]));
}

function envelopeText(envelope) {
  // The signed Agent transport serializes the page inside a result envelope.
  const serialized = JSON.stringify({ result: envelope });
  if (serialized.length >= MAX_TRANSPORT_CHARS ||
      Buffer.byteLength(serialized, 'utf8') >= MAX_TRANSPORT_CHARS) return null;
  return serialized;
}

function validSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || snapshot[SNAPSHOT_PAYLOAD] === undefined) return false;
  const payload = snapshot[SNAPSHOT_PAYLOAD];
  return payload && typeof payload.text === 'string' &&
    snapshot.version === RESPONSE_VERSION && snapshot.partial === true &&
    typeof snapshot.snapshotId === 'string' && snapshot.snapshotId === sha256(payload.text) &&
    Number.isSafeInteger(snapshot.total) && snapshot.total === payload.text.length &&
    Object.keys(snapshot).sort().join(',') === 'partial,snapshotId,total,version';
}

export function snapshotListProcessesResponse(callToolResult) {
  if (!callToolResult || typeof callToolResult !== 'object' || Array.isArray(callToolResult) ||
      callToolResult.isError === true || !Array.isArray(callToolResult.content) ||
      callToolResult.content.length !== 1 ||
      Object.hasOwn(callToolResult, 'structuredContent') ||
      Object.hasOwn(callToolResult, '_meta') ||
      Object.keys(callToolResult).some(key => !['content', 'isError', 'structuredContent', '_meta'].includes(key)))
    throw fail('P2_MCP_RESPONSE_UNSUPPORTED');
  const [block] = callToolResult.content;
  if (!block || typeof block !== 'object' || block.type !== 'text' || !validString(block.text))
    throw fail(block?.type === 'text' ? 'P2_MCP_RESPONSE_INVALID' : 'P2_MCP_RESPONSE_UNSUPPORTED');

  const snapshot = {
    version: RESPONSE_VERSION,
    partial: true,
    snapshotId: sha256(block.text),
    total: block.text.length,
  };
  Object.defineProperty(snapshot, SNAPSHOT_PAYLOAD, {
    value: Object.freeze({ text: block.text }), enumerable: false, writable: false, configurable: false,
  });
  return Object.freeze(snapshot);
}

export function pageListProcessesSnapshot(snapshot, options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options))
    throw fail('P2_MCP_REQUEST_INVALID');
  const { offset = 0, maxPageChars = DEFAULT_PAGE_CHARS } = options;
  if (!validSnapshot(snapshot)) throw fail('P2_MCP_SNAPSHOT_INVALID');
  const text = snapshot[SNAPSHOT_PAYLOAD].text;
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > snapshot.total || !validBoundary(text, offset))
    throw fail('P2_MCP_OFFSET_INVALID');
  if (!Number.isSafeInteger(maxPageChars) || maxPageChars < 1 || maxPageChars > MAX_PAGE_CHARS)
    throw fail('P2_MCP_PAGE_LIMIT_INVALID');

  let end = Math.min(offset + maxPageChars, snapshot.total);
  if (!validBoundary(text, end)) end -= 1;
  while (end > offset) {
    const pageText = text.slice(offset, end);
    const envelope = {
      version: RESPONSE_VERSION,
      partial: true,
      snapshotId: snapshot.snapshotId,
      start: offset,
      end,
      next: end < snapshot.total ? { offset: end } : null,
      total: snapshot.total,
      text: pageText,
      textHash: sha256(pageText),
    };
    if (envelopeText(envelope) !== null) return Object.freeze(envelope);
    end -= 1;
    if (!validBoundary(text, end)) end -= 1;
  }
  if (offset === snapshot.total) {
    const envelope = {
      version: RESPONSE_VERSION, partial: true, snapshotId: snapshot.snapshotId,
      start: offset, end: offset, next: null, total: snapshot.total, text: '', textHash: sha256(''),
    };
    if (envelopeText(envelope) !== null) return Object.freeze(envelope);
  }
  throw fail('P2_MCP_RESPONSE_ENVELOPE_INVALID');
}
