/**
 * Public, platform-neutral Agent V1 protocol core.
 * Reference: historical DC Agent transport contract. NOT a deployed service.
 * No environment access, SDK import, listener, secret, process control, or P2 bypass.
 */
import {createHash, createPublicKey, verify, KeyObject} from 'node:crypto';

export const AGENT_RELEASE_PROTOCOL = 'aicc-dc-agent-release-source/v1';
export const MAX_REQUEST_BYTES = 1_048_576;
export const MAX_RESPONSE_BYTES = 65_536;
const LEGACY_DENY = new Set(['set_config_value', 'force_terminate', 'restart']);
const TOOL_NAME = /^[a-z][a-z0-9_]{0,80}$/u;
const ED25519_B64 = /^[A-Za-z0-9+/]{86}==$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const plain = v => v !== null && typeof v === 'object' &&
  !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const addr = req => String(req.socket?.remoteAddress || '').replace(/^::ffff:/u, '');

function emit(res, status, payload, maxResponseBytes = MAX_RESPONSE_BYTES) {
  let text;
  try { text = JSON.stringify(payload); }
  catch { text = JSON.stringify({errorCode:'DC_AGENT_RESPONSE_INVALID'}); status = 502; }
  if (Buffer.byteLength(text) > maxResponseBytes) {
    status = 502;
    text = JSON.stringify({errorCode:'DC_AGENT_RESPONSE_TOO_LARGE'});
  }
  res.writeHead(status, {
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'x-content-type-options':'nosniff'
  });
  res.end(text);
}
async function bodyOf(req) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > MAX_REQUEST_BYTES) throw Object.assign(new Error('limit'), {code:'DC_AGENT_BODY_TOO_LARGE'});
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
function validSignature(req, route, body, key, now) {
  const ts = req.headers['x-byl-timestamp'];
  const signature = req.headers['x-byl-signature'];
  if (typeof ts !== 'string' || !/^[0-9]{13}$/u.test(ts) ||
      typeof signature !== 'string' || !ED25519_B64.test(signature)) return false;
  if (Math.abs(now - Number(ts)) > 60_000) return false;
  const canonical = [req.method, route, ts, digest(body)].join('\n');
  try { return verify(null, Buffer.from(canonical), key, Buffer.from(signature, 'base64')); }
  catch { return false; }
}
function validatedAllowedTools(list) {
  if (!Array.isArray(list) || list.length < 1 || list.length > 64 ||
      list.some(t => typeof t !== 'string' || !TOOL_NAME.test(t) ||
        LEGACY_DENY.has(t) || t.startsWith('p2_')) ||
      new Set(list).size !== list.length) throw Error('AGENT_TOOL_POLICY_INVALID');
  return new Set(list);
}

/**
 * Injected SDK bridge + audit are REQUIRED. This source knows no production topology.
 * Transport signature authenticates Gateway, not the OAuth user's authorization.
 * Operation-level OAuth policy must be independently proven before production use.
 */
export function createAgentHandler({
  publicKey, allowedPeer, allowedTools, listTools, callTool, auditEvent,
  clock = Date.now, maxResponseBytes = MAX_RESPONSE_BYTES
} = {}) {
  let key;
  try { key = publicKey instanceof KeyObject && publicKey.type === 'public' ? publicKey : createPublicKey(publicKey); }
  catch { throw Error('AGENT_PUBLIC_KEY_INVALID'); }
  if (key.asymmetricKeyType !== 'ed25519') throw Error('AGENT_PUBLIC_KEY_NOT_ED25519');
  if (typeof allowedPeer !== 'string' || !/^[0-9a-fA-F:.]{2,64}$/u.test(allowedPeer) ||
      typeof listTools !== 'function' || typeof callTool !== 'function' ||
      typeof auditEvent !== 'function' || typeof clock !== 'function' ||
      !Number.isInteger(maxResponseBytes) || maxResponseBytes < 256 ||
      maxResponseBytes > MAX_RESPONSE_BYTES) throw Error('AGENT_CONFIG_INVALID');

  const allowed = validatedAllowedTools(allowedTools);
  const used = new Map();
  let auditDegraded = false;

  async function audit(event, detail = {}) {
    await auditEvent({event, ...detail});
  }
  function replay(signature, now) {
    for (const [k, expires] of used) if (expires < now) used.delete(k);
    if (used.has(signature)) return true;
    if (used.size >= 512) used.delete(used.keys().next().value);
    used.set(signature, now + 60_000);
    return false;
  }
  return async function handler(req, res) {
    let route;
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (url.search || url.hash) return emit(res, 400, {errorCode:'DC_AGENT_QUERY_DENIED'}, maxResponseBytes);
      route = url.pathname;
      if (addr(req) !== allowedPeer) {
        await audit('peer_denied');
        return emit(res, 403, {errorCode:'DC_AGENT_PEER_DENIED'}, maxResponseBytes);
      }
      if (req.method === 'GET' && route === '/healthz') {
        const result = await listTools();
        const found = Array.isArray(result?.tools) ? result.tools : [];
        return emit(res, auditDegraded ? 503 : 200, {ok:!auditDegraded,
          service:'byl-dc-agent', protocol:AGENT_RELEASE_PROTOCOL,
          toolCount:found.filter(t => allowed.has(t?.name)).length,
          buildIdentityAttested:false, auditHealthy:!auditDegraded}, maxResponseBytes);
      }
      if (route === '/v1/restart') {
        await audit('restart_denied');
        return emit(res, 403, {errorCode:'DC_AGENT_RESTART_DISABLED'}, maxResponseBytes);
      }
      if (!(req.method === 'GET' && route === '/v1/tools') &&
          !(req.method === 'POST' && route === '/v1/call')) {
        return emit(res, 404, {errorCode:'DC_AGENT_NOT_FOUND'}, maxResponseBytes);
      }
      const body = req.method === 'POST' ? await bodyOf(req) : Buffer.alloc(0);
      const now = clock();
      if (!validSignature(req, route, body, key, now)) {
        await audit('signature_denied');
        return emit(res, 401, {errorCode:'DC_AGENT_SIGNATURE_INVALID'}, maxResponseBytes);
      }
      if (req.method === 'GET') {
        const out = await listTools();
        const items = Array.isArray(out?.tools) ? out.tools : [];
        return emit(res, 200, {tools:items.filter(t => allowed.has(t?.name)).map(t => ({
          name:t.name, description:typeof t.description==='string' ? t.description.slice(0,1024) : ''
        }))}, maxResponseBytes);
      }
      let input;
      try { input = JSON.parse(body.toString('utf8')); }
      catch { return emit(res, 400, {errorCode:'DC_AGENT_JSON_INVALID'}, maxResponseBytes); }
      if (!plain(input) || !TOOL_NAME.test(input.name || '') ||
          (input.arguments !== undefined && !plain(input.arguments))) {
        return emit(res, 400, {errorCode:'DC_AGENT_ARGUMENTS_INVALID'}, maxResponseBytes);
      }
      if (!allowed.has(input.name)) {
        await audit('tool_denied', {tool:typeof input.name==='string' ? input.name.slice(0,80) : 'invalid'});
        return emit(res, 403, {errorCode:'DC_AGENT_TOOL_DENIED'}, maxResponseBytes);
      }
      if (auditDegraded) {
        return emit(res, 503, {errorCode:'DC_AGENT_AUDIT_DEGRADED'}, maxResponseBytes);
      }
      if (replay(req.headers['x-byl-signature'], now)) {
        await audit('replay_denied', {tool:input.name});
        return emit(res, 409, {errorCode:'DC_AGENT_REPLAY_DENIED'}, maxResponseBytes);
      }
      // Fail closed if pre-call audit is unavailable. No tool arguments are logged.
      await audit('tool_call', {tool:input.name});
      const result = await callTool({name:input.name, arguments:input.arguments || {}});
      try {
        await audit('tool_result', {tool:input.name, ok:result?.isError !== true});
      } catch {
        // The tool already ran. Never report it as an unexecuted 502 or
        // permit later operations while the audit sink is unavailable.
        auditDegraded = true;
        return emit(res, 200, {result, auditState:'DEGRADED_POST_EXECUTION'}, maxResponseBytes);
      }
      return emit(res, 200, {result}, maxResponseBytes);
    } catch (err) {
      if (err?.code === 'DC_AGENT_BODY_TOO_LARGE')
        return emit(res, 413, {errorCode:'DC_AGENT_BODY_TOO_LARGE'}, maxResponseBytes);
      return emit(res, 502, {errorCode:'DC_AGENT_BRIDGE_UNAVAILABLE'}, maxResponseBytes);
    }
  };
}

export function candidateReleaseStatus() {
  return Object.freeze({protocol:AGENT_RELEASE_PROTOCOL, signedRunnableRelease:false,
    executingProcessIdentity:'UNVERIFIED', agentOnlyRollback:'UNVERIFIED',
    productionAgentCanary:'STOP', oauthCanary:'STOP'});
}
