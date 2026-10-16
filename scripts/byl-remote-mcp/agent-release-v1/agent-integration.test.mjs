import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {startApprovedAgent} from './agent-entry.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const MCP_FIXTURE=fileURLToPath(new URL('./fixtures/stdio-mcp-fixture.mjs',import.meta.url));
async function freeLoopbackPort() {
  const server=createServer((_,r)=>r.end());
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  await new Promise(resolve=>server.close(resolve));
  return port;
}
test('complete SDK stdio to HTTP Agent flow uses fake MCP fixture only',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'aicc-agent-runtime-e2e-'));
  const {publicKey,privateKey}=generateKeyPairSync('ed25519');
  const keyFile=join(dir,'gateway-public.pem');
  const auditFile=join(dir,'audit.jsonl');
  await writeFile(keyFile,publicKey.export({type:'spki',format:'pem'}),{mode:0o600});
  const port=await freeLoopbackPort();
  let live;
  try{
    const env={
      DC_AGENT_LISTEN_HOST:'127.0.0.1',
      DC_AGENT_GATEWAY_PEER:'127.0.0.1',
      DC_AGENT_LISTEN_PORT:String(port),
      DC_AGENT_MCP_ENTRY_FILE:MCP_FIXTURE,
      DC_AGENT_GATEWAY_PUBLIC_KEY_FILE:keyFile,
      DC_AGENT_AUDIT_FILE:auditFile,
      DC_AGENT_ALLOWED_TOOLS_JSON:JSON.stringify(['read_file'])
    };
    live=await startApprovedAgent({env});
    const url='http://127.0.0.1:'+port;
    const now=Date.now();
    async function signedRequest(method,route,body) {
      const bytes=Buffer.from(body===undefined?'':JSON.stringify(body),'utf8');
      const canonical=[method,route,String(now),sha(bytes)].join('\n');
      const signature=sign(null,Buffer.from(canonical),privateKey).toString('base64');
      const response=await fetch(url+route,{method,
        headers:{'x-byl-timestamp':String(now),'x-byl-signature':signature},
        body:method==='POST'?bytes:undefined});
      return {status:response.status,data:await response.json()};
    }
    const health=await fetch(url+'/healthz').then(r=>r.json());
    assert.equal(health.ok,true);
    assert.equal(health.toolCount,1);
    assert.equal(health.buildIdentityAttested,false);
    const tools=await signedRequest('GET','/v1/tools');
    assert.equal(tools.status,200);
    assert.deepEqual(tools.data.tools.map(t=>t.name),['read_file']);
    const result=await signedRequest('POST','/v1/call',{name:'read_file',arguments:{path:'synthetic'}});
    assert.equal(result.status,200);
    assert.equal(result.data.result.content[0].text,'FAKE_MCP_RESULT:synthetic');
    const denied=await signedRequest('POST','/v1/call',{name:'set_config_value',arguments:{}});
    assert.equal(denied.status,403);
    assert.equal((await signedRequest('POST','/v1/restart',{})).status,403);
    const audit=(await readFile(auditFile,'utf8')).split('\n').filter(Boolean).map(x=>JSON.parse(x));
    assert(audit.some(x=>x.event==='tool_call'&&x.tool==='read_file'));
    assert(!audit.some(x=>JSON.stringify(x).includes('synthetic')));
  }finally{
    if(live) await live.close();
    await rm(dir,{recursive:true,force:true});
  }
});
test('new Agent fails closed when private release-service injection is absent',async()=>{
  await assert.rejects(startApprovedAgent({env:{}}),/AGENT_PRIVATE_FILE_PATH_INVALID/);
});
