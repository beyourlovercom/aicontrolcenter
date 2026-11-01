import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createAiccV3Server} from '../server.mjs';

async function isolatedServer(v3Enabled,run){
 const home=mkdtempSync(join(tmpdir(),'aicc-v3-runtime-gate-'));
 const env={AICC_V3_HOME:home,AICC_EXECUTOR_GOVERNANCE_V3_ENABLED:v3Enabled?'1':'0'};
 const server=createAiccV3Server({env,remoteRunnerBaseUrl:null});
 try{
  // After construction the environment changes; mode must remain bound.
  env.AICC_EXECUTOR_GOVERNANCE_V3_ENABLED=v3Enabled?'0':'1';
  await new Promise((resolve,reject)=>{
   server.once('error',reject);server.listen(0,'127.0.0.1',resolve);
  });
  try{await run('http://127.0.0.1:'+server.address().port,home);}
  finally{await new Promise(resolve=>server.close(resolve));}
 }finally{rmSync(home,{force:true,recursive:true});}
}

test('V3 live API blocks direct Codex run before parsing payload or writing state',async()=>{
 await isolatedServer(true,async(base,home)=>{
  const health=await fetch(base+'/api/health').then(r=>r.json());
  assert.deepEqual(health.governance,{
   mode:'DC_PRIMARY_V3_DEV',directRun:'STOP',automaticDcDispatch:'STOP'
  });
  const invalid=await fetch(base+'/api/runs',{method:'POST',body:'{invalid json'});
  assert.equal(invalid.status,403);
  assert.deepEqual(await invalid.json(),{
   ok:false,errorCode:'EXECUTOR_V3_DIRECT_RUN_NOT_AUTHORIZED'
  });
  const valid=await fetch(base+'/api/runs',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({taskId:'untrusted',instruction:'execute'})});
  assert.equal(valid.status,403);
  assert.equal((await valid.json()).errorCode,'EXECUTOR_V3_DIRECT_RUN_NOT_AUTHORIZED');
  assert.deepEqual(readdirSync(home),[],'no implicit state/task/run/credential writes');
 });
});
test('V3 flag is opt-in: legacy default retains old request validation',async()=>{
 await isolatedServer(false,async(base)=>{
  const health=await fetch(base+'/api/health').then(r=>r.json());
  assert.equal(health.governance,undefined);
  const res=await fetch(base+'/api/runs',{method:'POST',body:'{invalid json'});
  const body=await res.json();
  assert.equal(body.errorCode,'REQUEST_JSON_INVALID');
  assert.notEqual(res.status,201);
 });
});
