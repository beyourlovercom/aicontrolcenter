import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {EventEmitter} from 'node:events';
import {createRemoteRunnerService} from '../lib/remote-runner-service.mjs';
import {RemoteRunnerClient} from '../lib/remote-runner-client.mjs';

function hangingSpawner(){
  const child=new EventEmitter();
  child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.pid=12345;
  return child;
}

function makeGitRepo(parent){
  const repo=join(parent,'repo');mkdirSync(repo);
  execFileSync('git',['init','-b','feat/test'],{cwd:repo,encoding:'utf8'});
  execFileSync('git',['config','user.email','t@t'],{cwd:repo,encoding:'utf8'});
  execFileSync('git',['config','user.name','T'],{cwd:repo,encoding:'utf8'});
  writeFileSync(join(repo,'f'),'x');
  execFileSync('git',['add','.'],{cwd:repo,encoding:'utf8'});
  execFileSync('git',['commit','-m','init'],{cwd:repo,encoding:'utf8'});
  execFileSync('git',['remote','add','origin','https://github.com/test/repo.git'],{cwd:repo,encoding:'utf8'});
  return repo;
}

function getHead(repo){return execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();}

function buildRunnerServer(service,allowedRemote){
  function checkPeer(remote){
    if(!allowedRemote)return true;
    const allowed=allowedRemote.split(',').map(s=>s.trim()).filter(Boolean);
    const addr=(remote||'').replace(/^::ffff:/,'');
    return allowed.includes(addr)||allowed.includes(remote||'');
  }
  function json(res,status,body){res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body));}
  return createServer(async(req,res)=>{
    const remote=req.socket?.remoteAddress||'';
    if(!checkPeer(remote))return json(res,403,{errorCode:'REMOTE_RUNNER_PEER_DENIED'});
    const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
    const parts=url.pathname.split('/').filter(Boolean);
    let body='';req.on('data',c=>body+=c);await new Promise(r=>req.on('end',r));
    try{
      if(req.method==='GET'&&url.pathname==='/v1/health')return json(res,200,service.health());
      if(req.method==='GET'&&url.pathname==='/v1/status')return json(res,200,service.status());
      if(req.method==='POST'&&url.pathname==='/v1/executions'){
        let input;try{input=JSON.parse(body);}catch{return json(res,400,{errorCode:'REMOTE_RUNNER_JSON_INVALID'});}
        return json(res,202,service.submit(input));
      }
      if(req.method==='GET'&&parts[0]==='v1'&&parts[1]==='executions'&&parts[2]){
        const rec=service.get(decodeURIComponent(parts[2]));
        return rec?json(res,200,rec):json(res,404,{errorCode:'REMOTE_RUNNER_EXECUTION_NOT_FOUND'});
      }
      return json(res,404,{errorCode:'REMOTE_RUNNER_NOT_FOUND'});
    }catch(error){json(res,409,{errorCode:error?.code||'REMOTE_RUNNER_ERROR'});}
  });
}

async function withServer(service,allowedRemote,fn){
  const server=buildRunnerServer(service,allowedRemote);
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const {port}=server.address();
  try{await fn(`http://127.0.0.1:${port}`);}finally{await new Promise(r=>server.close(r));}
}

test('health endpoint returns ok',async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'aicc-rra-'));
  try{
    const svc=createRemoteRunnerService(tmp,{spawn:()=>{throw new Error('no');}});
    await withServer(svc,null,async(base)=>{
      const client=new RemoteRunnerClient(base);
      const h=await client.health();
      assert.equal(h.ok,true);assert.equal(h.provider,'REMOTE_CLAUDE');
    });
  }finally{rmSync(tmp,{recursive:true,force:true});}
});

test('status endpoint returns ready and allowedRoot',async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'aicc-rra-'));
  try{
    const svc=createRemoteRunnerService(tmp,{spawn:()=>{throw new Error('no');}});
    await withServer(svc,null,async(base)=>{
      const client=new RemoteRunnerClient(base);
      const s=await client.status();
      assert.equal(s.ready,true);assert.equal('allowedRoot' in s,false);
    });
  }finally{rmSync(tmp,{recursive:true,force:true});}
});

test('peer IP allowlist blocks disallowed remote',async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'aicc-rra-'));
  try{
    const svc=createRemoteRunnerService(tmp,{spawn:()=>{throw new Error('no');}});
    await withServer(svc,'10.0.0.1',async(base)=>{
      const client=new RemoteRunnerClient(base);
      await assert.rejects(()=>client.health(),e=>e?.code==='REMOTE_RUNNER_PEER_DENIED');
    });
  }finally{rmSync(tmp,{recursive:true,force:true});}
});

test('peer IP allowlist allows 127.0.0.1',async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'aicc-rra-'));
  try{
    const svc=createRemoteRunnerService(tmp,{spawn:()=>{throw new Error('no');}});
    await withServer(svc,'127.0.0.1',async(base)=>{
      const client=new RemoteRunnerClient(base);
      const h=await client.health();assert.equal(h.ok,true);
    });
  }finally{rmSync(tmp,{recursive:true,force:true});}
});

test('submit returns QUEUED execution and GET retrieves it',async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'aicc-rra-'));
  try{
    const repo=makeGitRepo(tmp);const head=getHead(repo);
    const svc=createRemoteRunnerService(tmp,{spawn:()=>hangingSpawner(),uuid:()=>'exec-api-1'});
    await withServer(svc,null,async(base)=>{
      const client=new RemoteRunnerClient(base);
      const rec=await client.submit({executionId:'exec-api-1',provider:'CLAUDE_CODE',executionClass:'CODE_CHANGE',providerRoutingReason:'api test',workPackageId:'wp-api',remoteRepositoryRoot:repo,repositoryIdentity:'test/repo',expectedBranch:'feat/test',expectedHead:head,dryRun:true});
      assert.equal(rec.executionId,'exec-api-1');
      const fetched=await client.get('exec-api-1');
      assert.equal(fetched.executionId,'exec-api-1');
    });
  }finally{rmSync(tmp,{recursive:true,force:true});}
});

test('submit rejects invalid provider',async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'aicc-rra-'));
  try{
    const repo=makeGitRepo(tmp);const head=getHead(repo);
    const svc=createRemoteRunnerService(tmp,{spawn:()=>{throw new Error('no');}});
    await withServer(svc,null,async(base)=>{
      const client=new RemoteRunnerClient(base);
      await assert.rejects(()=>client.submit({provider:'CODEX',executionClass:'TEST_ONLY',providerRoutingReason:'r',workPackageId:'wp',remoteRepositoryRoot:repo,repositoryIdentity:'test/repo',expectedBranch:'feat/test',expectedHead:head,instruction:'t'}),e=>e?.code==='REMOTE_RUNNER_PROVIDER_INVALID');
    });
  }finally{rmSync(tmp,{recursive:true,force:true});}
});
