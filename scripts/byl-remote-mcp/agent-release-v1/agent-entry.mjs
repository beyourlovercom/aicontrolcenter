/**
 * Portable Agent release entrypoint. Intended for a separately approved
 * service manager. Never imported or launched by GitHub PR CI.
 *
 * Signed Gateway transport is not sufficient operator policy authorization.
 * Release/rollback attestation and OAuth per-operation policy remain separate.
 */
import {createServer} from 'node:http';
import {isIP} from 'node:net';
import {isAbsolute} from 'node:path';
import {readFile, appendFile, stat} from 'node:fs/promises';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {createAgentHandler} from './agent-core.mjs';

function privateBind(value) {
  if (typeof value !== 'string' || isIP(value) !== 4 || value === '0.0.0.0') return false;
  const p = value.split('.').map(Number), [a,b] = p;
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}
function privateFilePath(value) {
  if (typeof value !== 'string' || !isAbsolute(value) || value.length > 1024 ||
      value.includes('\0')) throw Error('AGENT_PRIVATE_FILE_PATH_INVALID');
  return value;
}
function releaseConfig(env) {
  const bind = env.DC_AGENT_LISTEN_HOST;
  const peer = env.DC_AGENT_GATEWAY_PEER;
  const rawPort = env.DC_AGENT_LISTEN_PORT;
  const command = privateFilePath(env.DC_AGENT_MCP_ENTRY_FILE);
  const audit = privateFilePath(env.DC_AGENT_AUDIT_FILE);
  const key = privateFilePath(env.DC_AGENT_GATEWAY_PUBLIC_KEY_FILE);
  if (!privateBind(bind) || !privateBind(peer) || !/^[0-9]{1,5}$/u.test(rawPort || ''))
    throw Error('AGENT_NETWORK_CONFIG_INVALID');
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw Error('AGENT_PORT_INVALID');
  let allowedTools;
  try { allowedTools = JSON.parse(env.DC_AGENT_ALLOWED_TOOLS_JSON || ''); }
  catch { throw Error('AGENT_ALLOWED_TOOLS_REQUIRED'); }
  // The core validates the exact allowed tool names; never discover-and-allow all.
  return {bind,peer,port,command,audit,key,allowedTools};
}
async function createSdkBridge(command) {
  const info = await stat(command);
  if (!info.isFile()) throw Error('AGENT_MCP_ENTRY_NOT_FILE');
  let client = null, transport = null, pending = null;
  async function invalidate() {
    client = null;
    const previous = transport;
    transport = null;
    try { await previous?.close(); } catch {}
  }
  async function getClient() {
    if (client) return client;
    if (pending) return pending;
    pending = (async () => {
      const c = new Client({name:'aicc-dc-agent-v1', version:'1.0.0'},
        {capabilities:{}});
      const childEnv = {};
      for (const k of ['PATH','HOME','LANG','TMPDIR','NODE_ENV','USER']) {
        if (typeof process.env[k] === 'string') childEnv[k] = process.env[k];
      }
      const t = new StdioClientTransport({command:process.execPath,
        args:[command], env:childEnv, stderr:'pipe'});
      try {
        await c.connect(t);
        client = c;
        transport = t;
        return c;
      } catch (e) {
        try { await t.close(); } catch {}
        throw e;
      }
    })().finally(() => { pending = null; });
    return pending;
  }
  return {
    listTools: async () => {
      try { return await (await getClient()).listTools(); }
      catch (e) { await invalidate(); throw e; }
    },
    callTool: async call => {
      try { return await (await getClient()).callTool(call); }
      catch (e) { await invalidate(); throw e; }
    },
    close: invalidate
  };
}
export async function startApprovedAgent({
  env = process.env, auditWrite = appendFile, bridgeFactory = createSdkBridge,
  serverFactory = createServer
} = {}) {
  const cfg = releaseConfig(env);
  const gatewayKey = await readFile(cfg.key, 'utf8');
  const sdk = await bridgeFactory(cfg.command);
  let server;
  try {
    const handler = createAgentHandler({
      publicKey:gatewayKey, allowedPeer:cfg.peer, allowedTools:cfg.allowedTools,
      listTools:sdk.listTools, callTool:sdk.callTool,
      auditEvent:record => auditWrite(cfg.audit,
        JSON.stringify({ts:new Date().toISOString(), ...record})+'\n',
        {encoding:'utf8',mode:0o600,flag:'a'})
    });
    server = serverFactory(handler);
    await new Promise((resolve, reject) => {
      server.once('error',reject);
      server.listen(cfg.port,cfg.bind,() => {
        server.off('error',reject);
        resolve();
      });
    });
  } catch(e) {
    try { server?.close(); } catch {}
    try { await sdk.close(); } catch {}
    throw e;
  }
  // This is a controlled process stop handler, not a restart API.
  function stop() {
    server.close(() => sdk.close().catch(() => {}));
  }
  process.once('SIGTERM',stop);
  process.once('SIGINT',stop);
  return {server, close:async () => {
    process.off('SIGTERM',stop);
    process.off('SIGINT',stop);
    await new Promise(resolve=>server.close(resolve));
    await sdk.close();
  }};
}
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  startApprovedAgent().then(
    () => { process.stdout.write('AICC_DC_AGENT_V1_SOURCE_STARTED\n'); },
    () => { process.stderr.write('AGENT_STARTUP_DENIED\n'); process.exitCode = 1; }
  );
}
