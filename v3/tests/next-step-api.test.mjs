import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createAiccV3Server} from '../server.mjs';
import {createChatgptProjectionStore} from '../lib/chatgpt-projection.mjs';
import {ensureBridgeCredential} from '../lib/bridge-store.mjs';

function git(cwd,...args){return execFileSync('git',args,{cwd,encoding:'utf8'}).trim();}
function fixture(){
  const root=mkdtempSync(join(tmpdir(),'aicc-v54-api-'));const repo=join(root,'repo');const home=join(root,'state');
  mkdirSync(repo);mkdirSync(home);git(repo,'init','-b','test/next-step');git(repo,'config','user.email','aicc@example.invalid');git(repo,'config','user.name','AICC Test');
  writeFileSync(join(repo,'README.md'),'next-step\n');git(repo,'add','.');git(repo,'commit','-m','fixture');
  writeFileSync(join(home,'project.json'),JSON.stringify({schema:'aicc.v3.project.v1',id:'fixture',name:'Fixture',repositoryIdentity:'example/next-step',repositoryPath:repo}));
  return {home,repo};
}
function readyExecutor(){return {ready:true,checkedAt:'2026-09-14T09:00:00.000Z',path:'/fake/codex',version:'0.test',model:'test',authMode:'test',doctorStatus:'ok',diagnostics:[]};}
async function withServer(fx,run){
  const projection=createChatgptProjectionStore({now:()=> '2026-09-14T09:00:00.000Z'});
  projection.upsert({conversationId:'conv-v54',conversationUrl:'https://chatgpt.com/c/conv-v54',title:'V5.4',tabId:7,messages:[{role:'assistant',text:'ready'}]});
  const env={AICC_V3_HOME:fx.home};const server=createAiccV3Server({env,chatgptProjectionStore:projection,executorOptions:{preflight:readyExecutor}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const {port}=server.address();
  try{await run(`http://127.0.0.1:${port}`,env);}finally{await new Promise(resolve=>server.close(resolve));}
}
function requestBody(repo){return {roomId:'room-v54',roomName:'V5.4 Room',workstreamId:'next-step',branch:'test/next-step',worktree:repo,conversationId:'conv-v54',draft:'advance safely'};}

test('Next-Step HTTP loop freezes intent, allows one authenticated claim, and records STOP_GATE',async()=>{
  const fx=fixture();await withServer(fx,async(base,env)=>{
    const create=await fetch(`${base}/api/next-step/requests`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(requestBody(fx.repo))});
    const created=await create.json();assert.equal(create.status,201);assert.equal(created.state.state,'PENDING');assert.match(created.request.prompt,/AICC_NEXT_STEP_V1/);
    const token=ensureBridgeCredential(env);const auth={'content-type':'application/json','x-aicc-bridge-token':token};
    const claim=await fetch(`${base}/api/bridge/next-step/claim`,{method:'POST',headers:auth,body:JSON.stringify({bridgeInstanceId:'bridge-test'})}).then(r=>r.json());
    assert.equal(claim.claimed.request.requestId,created.request.requestId);assert.equal(claim.claimed.state.state,'CLAIMED');
    const claimId=claim.claimed.state.claim.claimId;
    const decision={decision:'STOP_GATE',workPackageTitle:null,taskTitle:null,instruction:null,gateReason:'Owner approval required'};
    const receipt=await fetch(`${base}/api/bridge/next-step/${created.request.requestId}/receipt`,{method:'POST',headers:auth,body:JSON.stringify({claimId,outcome:'STOP_GATE',decision})});
    assert.equal(receipt.status,200);
    const projection=await fetch(`${base}/api/next-step/requests/${created.request.requestId}`).then(r=>r.json());
    assert.equal(projection.state.state,'STOP_GATE');assert.equal(projection.state.decision.gateReason,'Owner approval required');
  });
});

test('Next-Step HTTP create rejects runtime drift before any intent is persisted',async()=>{
  const fx=fixture();await withServer(fx,async base=>{
    const body={...requestBody(fx.repo),branch:'wrong/branch'};
    const response=await fetch(`${base}/api/next-step/requests`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    const value=await response.json();assert.equal(response.status,409);assert.equal(value.errorCode,'NEXT_STEP_RUNTIME_DRIFT');
  });
});
