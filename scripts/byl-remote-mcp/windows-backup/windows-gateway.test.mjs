import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
const delay=ms=>new Promise(ok=>setTimeout(ok,ms));
test('Windows backup MCP localhost E2E + public Auth fail-closed', {timeout:40000},async()=>{
 const root=mkdtempSync(join(tmpdir(),'byl-backup-mcp-'));
 const tokenFile=join(root,'private-token');
 const token=randomBytes(48).toString('base64url');
 writeFileSync(tokenFile,token+'\n');
 const env={...process.env,BYL_WIN_BACKUP_ROOT:root,BYL_WIN_BACKUP_TOKEN_FILE:tokenFile,
  BYL_WIN_PUBLIC_HOST:'mcp-win-uat.beyourlover.com',
  BYL_WIN_ACCESS_ISSUER:'https://example.cloudflareaccess.com',
  BYL_WIN_ACCESS_AUDIENCE:'a'.repeat(64),BYL_WIN_ACCESS_OWNER:'owner@example.com'};
 const proc=spawn(process.execPath,['windows-gateway.mjs'],{cwd:resolve(import.meta.dirname),env,stdio:'pipe',windowsHide:true});
 let stderr='';proc.stderr.on('data',d=>{stderr+=String(d)});
 const base='http://127.0.0.1:8892';
 let requestId=0;
 try{
  let healthy=false;
  for(let i=0;i<70;i++){await delay(200);if(proc.exitCode!==null)throw Error('BACKUP_EXITED: '+stderr);
   try{const r=await fetch(base+'/healthz',{signal:AbortSignal.timeout(500)});if(r.ok){healthy=true;break}}catch{}
  }
  assert.equal(healthy,true,'startup health');
  async function rpc(method,params,{bearer=true,publicHost=false}={}){
   const r=await fetch(base+'/mcp',{method:'POST',headers:{'content-type':'application/json','accept':'application/json, text/event-stream',
     ...(bearer?{'authorization':'Bearer '+token}:{}),...(publicHost?{'host':'mcp-win-uat.beyourlover.com'}:{})},
    body:JSON.stringify({jsonrpc:'2.0',id:++requestId,method,params}),signal:AbortSignal.timeout(6000)});
   return {status:r.status,body:await r.json()};
  }
  const initParams={protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'ci',version:'1'}};
  assert.equal((await rpc('initialize',initParams,{bearer:false})).status,401);
  assert.equal((await rpc('initialize',initParams,{bearer:true,publicHost:true})).status,401,'local bearer must not bypass public Access');
  const init=await rpc('initialize',initParams);
  assert.equal(init.status,200);
  assert.ok(init.body.result.protocolVersion);
  const list=await rpc('tools/list',{});
  assert.ok(list.body.result.tools.some(x=>x.name==='start_process'));
  const call=async(name,args)=>{const r=await rpc('tools/call',{name,arguments:args});return JSON.stringify(r.body)};
  const version=await call('start_process',{command:'git --version',timeout_ms:8000});
  assert.match(version,/git version/);
  const file=join(root,'fixture.txt');
  assert.match(await call('write_file',{path:file,content:'ORIGINAL'}),/FILE_WRITTEN/);
  assert.match(await call('edit_block',{path:file,old_string:'ORIGINAL',new_string:'UPDATED'}),/FILE_EDITED/);
  assert.match(await call('read_file',{path:file}),/UPDATED/);
  assert.equal(readFileSync(file,'utf8'),'UPDATED');
  assert.match(await call('read_file',{path:join(tmpdir(),'not-allowed-file')}),/OUTSIDE_PROJECT_ROOT/);
 }finally{proc.kill();rmSync(root,{force:true,recursive:true})}
});
