import { randomBytes as nodeRandomBytes } from 'node:crypto';
import {
  DEFAULT_PAGE_CHARS,
  MAX_PAGE_CHARS,
  MAX_TRANSPORT_CHARS,
  pageListProcessesSnapshot,
  snapshotListProcessesResponse,
} from './p2-bounded-mcp-response.mjs';

export const P2_AGENT_SNAPSHOT_BRIDGE_VERSION = 'aicc-p2-agent-snapshot-bridge/v1';
export const DEFAULT_SESSION_TTL_MS = 30_000;
export const MAX_SESSIONS = 8;
export const MAX_SNAPSHOT_CHARS = 131_072;
export const OUTER_TRANSPORT_RESERVE = 1_024;
export const CANONICAL_DEVICE_IDS = Object.freeze([
  'us-macmini', 'china-mac', 'windows', '007windows',
]);

const HANDLE_BYTES = 24;
const HANDLE_PATTERN = /^[A-Za-z0-9_-]{32,128}$/u;
const ERROR_CODES = Object.freeze({
  invalidRequest: 'P2_AGENT_REQUEST_INVALID',
  unauthorized: 'P2_AGENT_UNAUTHORIZED',
  unavailable: 'P2_AGENT_UNAVAILABLE',
  handle: 'P2_AGENT_HANDLE_INVALID',
  expired: 'P2_AGENT_SNAPSHOT_EXPIRED',
  mismatch: 'P2_AGENT_SNAPSHOT_MISMATCH',
  source: 'P2_AGENT_SOURCE_FAILED',
  unsupported: 'P2_AGENT_SOURCE_UNSUPPORTED',
  response: 'P2_AGENT_RESPONSE_LIMIT',
});

function errorResponse(code) {
  return Object.freeze({ error: Object.freeze({ code }) });
}

function fail(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function safeErrorCode(error) {
  try {
    return error !== null && (typeof error === 'object' || typeof error === 'function') &&
      typeof error.code === 'string' ? error.code : undefined;
  } catch {
    return undefined;
  }
}

function validClock(clock) {
  return clock && typeof clock.now === 'function';
}

function validRequestContext(requestContext) {
  return requestContext !== null && (typeof requestContext === 'object' || typeof requestContext === 'function');
}

function validStartRequest(request) {
  return request && typeof request === 'object' && !Array.isArray(request) && Object.keys(request).length === 0;
}

function validNextRequest(request) {
  return request && typeof request === 'object' && !Array.isArray(request) &&
    Object.keys(request).length === 2 && typeof request.handle === 'string' &&
    Number.isSafeInteger(request.offset) && request.offset >= 0 && HANDLE_PATTERN.test(request.handle);
}

function encodeHandle(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 16) throw fail(ERROR_CODES.unavailable);
  return Buffer.from(bytes).toString('base64url');
}

function transportFits(page, handle) {
  const serialized = JSON.stringify({ result: { ...page, handle } });
  const maxSerialized = MAX_TRANSPORT_CHARS - OUTER_TRANSPORT_RESERVE;
  return serialized.length < maxSerialized && Buffer.byteLength(serialized, 'utf8') < maxSerialized;
}

function pageWithHandle(snapshot, offset, handle, requestedChars) {
  let limit = Math.min(requestedChars, MAX_PAGE_CHARS);
  while (limit >= 1) {
    try {
      const page = pageListProcessesSnapshot(snapshot, { offset, maxPageChars: limit });
      if (transportFits(page, handle)) return page;
    } catch (error) {
      if (safeErrorCode(error) !== 'P2_MCP_RESPONSE_ENVELOPE_INVALID') throw error;
    }
    limit = Math.max(1, Math.floor(limit / 2));
    if (limit === 1) {
      try {
        const page = pageListProcessesSnapshot(snapshot, { offset, maxPageChars: 1 });
        if (transportFits(page, handle)) return page;
      } catch (error) {
        if (safeErrorCode(error) !== 'P2_MCP_RESPONSE_ENVELOPE_INVALID') throw error;
      }
      break;
    }
  }
  throw fail(ERROR_CODES.response);
}

export function createP2AgentSnapshotBridge(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options) ||
      typeof options.callTool !== 'function' || typeof options.authorize !== 'function') {
    throw fail(ERROR_CODES.unavailable);
  }
  const clock = options.clock ?? { now: () => Date.now() };
  const ttlMs = options.ttlMs ?? DEFAULT_SESSION_TTL_MS;
  const maxPageChars = options.maxPageChars ?? DEFAULT_PAGE_CHARS;
  if (!validClock(clock) ||
      !Number.isSafeInteger(ttlMs) || ttlMs <= 0 ||
      !Number.isSafeInteger(maxPageChars) || maxPageChars < 1 || maxPageChars > MAX_PAGE_CHARS) {
    throw fail(ERROR_CODES.unavailable);
  }

  const sessions = new Map();
  let sequence = 0;
  let inFlightStarts = 0;

  function evictExpired(now) {
    for (const [handle, session] of sessions) if (session.expiresAt <= now) sessions.delete(handle);
  }

  function newHandle() {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const handle = encodeHandle(nodeRandomBytes(HANDLE_BYTES));
      if (!sessions.has(handle)) return handle;
    }
    throw fail(ERROR_CODES.unavailable);
  }

  async function authorize(operation, requestContext) {
    if (!validRequestContext(requestContext)) throw fail(ERROR_CODES.unauthorized);
    let decision;
    try {
      decision = await options.authorize({ operation, requestContext });
    } catch {
      throw fail(ERROR_CODES.unauthorized);
    }
    if (!decision || typeof decision !== 'object' || Array.isArray(decision) ||
        typeof decision.principal !== 'string' || decision.principal.trim() === '' ||
        !CANONICAL_DEVICE_IDS.includes(decision.deviceId) || decision.provenance !== 'server-verified' ||
        typeof decision.authorizationBinding !== 'string' || decision.authorizationBinding.trim() === '' ||
        decision.allowed !== true) throw fail(ERROR_CODES.unauthorized);
    return Object.freeze({
      principal: decision.principal,
      deviceId: decision.deviceId,
      authorizationBinding: decision.authorizationBinding,
    });
  }

  async function request(operation, request, requestContext) {
    try {
      if (operation !== 'p2_list_processes_start' && operation !== 'p2_list_processes_next')
        return errorResponse(ERROR_CODES.invalidRequest);
      if (operation === 'p2_list_processes_start' && !validStartRequest(request))
        return errorResponse(ERROR_CODES.invalidRequest);
      if (operation === 'p2_list_processes_next' && !validNextRequest(request))
        return errorResponse(ERROR_CODES.invalidRequest);
      const identity = await authorize(operation, requestContext);
      const now = clock.now();
      if (!Number.isFinite(now)) return errorResponse(ERROR_CODES.unavailable);

      if (operation === 'p2_list_processes_start') {
        evictExpired(now);
        if (sessions.size >= MAX_SESSIONS) {
          const oldest = [...sessions.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt || a[1].sequence - b[1].sequence)[0];
          if (oldest) sessions.delete(oldest[0]);
        }
        if (sessions.size + inFlightStarts >= MAX_SESSIONS) return errorResponse(ERROR_CODES.unavailable);
        inFlightStarts += 1;
        let sourceResult;
        try {
          sourceResult = await options.callTool({ name: 'list_processes', arguments: {} });
        } catch (error) {
          return errorResponse(safeErrorCode(error) === 'P2_MCP_RESPONSE_UNSUPPORTED' ? ERROR_CODES.unsupported : ERROR_CODES.source);
        } finally {
          inFlightStarts -= 1;
        }
        let snapshot;
        try {
          snapshot = snapshotListProcessesResponse(sourceResult);
        } catch (error) {
          const code = safeErrorCode(error);
          return errorResponse(typeof code === 'string' && code.startsWith('P2_MCP_RESPONSE_UNSUPPORTED') ? ERROR_CODES.unsupported : ERROR_CODES.source);
        }
        if (snapshot.total > MAX_SNAPSHOT_CHARS) return errorResponse(ERROR_CODES.source);
        let handle;
        try { handle = newHandle(); } catch { return errorResponse(ERROR_CODES.unavailable); }
        const page = pageWithHandle(snapshot, 0, handle, maxPageChars);
        if (page.next !== null) {
          sessions.set(handle, {
            principal: identity.principal, deviceId: identity.deviceId,
            authorizationBinding: identity.authorizationBinding, snapshot,
            nextOffset: page.next.offset, expiresAt: now + ttlMs, createdAt: now, sequence: sequence++,
          });
        }
        return { result: { ...page, handle } };
      }

      const session = sessions.get(request.handle);
      if (!session) return errorResponse(ERROR_CODES.handle);
      if (session.expiresAt <= now) {
        sessions.delete(request.handle);
        return errorResponse(ERROR_CODES.expired);
      }
      if (session.principal !== identity.principal || session.deviceId !== identity.deviceId ||
          session.authorizationBinding !== identity.authorizationBinding)
        return errorResponse(ERROR_CODES.mismatch);
      if (session.nextOffset === null || request.offset !== session.nextOffset)
        return errorResponse(ERROR_CODES.invalidRequest);
      const page = pageWithHandle(session.snapshot, request.offset, request.handle, maxPageChars);
      if (page.next === null) sessions.delete(request.handle);
      else session.nextOffset = page.next.offset;
      return { result: { ...page, handle: request.handle } };
    } catch (error) {
      const code = safeErrorCode(error);
      return errorResponse(Object.values(ERROR_CODES).includes(code) ? code : ERROR_CODES.unavailable);
    }
  }

  return Object.freeze({ request });
}
