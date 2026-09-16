import test from 'node:test';
import assert from 'node:assert/strict';
import {chmodSync,mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createAiccV3Server} from '../server.mjs';
import {ensureBridgeCredential} from '../lib/bridge-store.mjs';
import {runtimeStateKey} from '../lib/runtime-state.mjs';
import {readLease,reserveLease} from '../lib/run-store.mjs';

function context(path){
  return {project:{id:'shared-project',name:'Shared'},repository:{identity:'owner/repo',path,branch:'feat/test',head:'abc',dirty:false}};
}

test('two Rooms in the same project isolate executor leases by exact worktree',()=>{
  const home=mkdtempSync(join(tmpdir(),'aicc-v55-rooms-'));const a=join(home,'wt-a');const b=join(home,'wt-b');mkdirSync(a);mkdirSync(b);
  const env={AICC_V3_HOME:join(home,'state')};const ca=context(a),cb=context(b);
  try{
    assert.notEqual(runtimeStateKey(ca),runtimeStateKey(cb));
    const la=reserveLease(ca,'run-a',env,{now:()=> '2026-09-15T08:30:00.000Z'});
    const lb=reserveLease(cb,'run-b',env,{now:()=> '2026-09-15T08:30:01.000Z'});
    assert.equal(la.runId,'run-a');assert.equal(lb.runId,'run-b');
    assert.equal(readLease(ca,env)?.runId,'run-a');assert.equal(readLease(cb,env)?.runId,'run-b');
  }finally{rmSync(home,{recursive:true,force:true});}
});


function git(cwd,...args){return execFileSync('git',args,{cwd,encoding:'utf8'}).trim();}
async function waitForBridge(base,requestId,headers,timeout=10000){
  const end=Date.now()+timeout;
  while(Date.now()<end){
    const response=await fetch(`${base}/api/bridge/requests/${requestId}`,{headers});
    const value=await response.json();
    if(response.ok&&value.bridge?.delivery)return value.bridge;
    await new Promise(resolve=>setTimeout(resolve,40));
  }
  throw new Error(`timeout waiting for bridge delivery ${requestId}`);
}

test('two real Git worktrees run concurrently through one backend without Room cross-talk',async()=>{
  const root=mkdtempSync(join(tmpdir(),'aicc-v55-e2e-'));const repo=join(root,'repo');const wtA=join(root,'wt-a');const wtB=join(root,'wt-b');const home=join(root,'state');
  mkdirSync(repo);mkdirSync(home);git(repo,'init','-b','main');git(repo,'config','user.email','aicc@example.invalid');git(repo,'config','user.name','AICC Test');
  writeFileSync(join(repo,'README.md'),'multi-room\n');git(repo,'add','.');git(repo,'commit','-m','fixture');
  git(repo,'worktree','add','-b','room/a',wtA,'main');git(repo,'worktree','add','-b','room/b',wtB,'main');
  const fake=join(root,'fake-codex');
  writeFileSync(fake,`#!/usr/bin/env node\nlet input='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{console.log(JSON.stringify({type:'thread.started',thread_id:'multi-room-session'}));setTimeout(()=>{console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'RESULT '+process.cwd()+' '+input.trim()}}));process.exit(0);},700);});\n`);chmodSync(fake,0o755);
  writeFileSync(join(home,'project.json'),JSON.stringify({schema:'aicc.v3.project.v1',id:'shared-project',name:'Shared Project',repositoryIdentity:'owner/repo',repositoryPath:wtA}));
  const env={AICC_V3_HOME:home};const executorOptions={preflight:()=>({ready:true,path:fake,version:'fake-v55',model:'fake',authMode:'test',doctorStatus:'ok',diagnostics:[]})};
  const server=createAiccV3Server({env,executorOptions});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const {port}=server.address();const base=`http://127.0.0.1:${port}`;
  const token=ensureBridgeCredential(env);const headers={'content-type':'application/json','x-aicc-bridge-token':token};
  const headA=git(wtA,'rev-parse','HEAD'),headB=git(wtB,'rev-parse','HEAD');
  const request=(id,roomId,workstreamId,conversationId,path,branch,head,instruction)=>({provider:'chatgpt-web',requestId:id,conversationId,originTurnId:`turn-${roomId}`,workPackageTitle:`WP ${roomId}`,taskTitle:`Task ${roomId}`,instruction,roomId,workstreamId,runtimeBinding:{projectId:'shared-project',projectName:'Shared Project',repositoryIdentity:'owner/repo',repositoryPath:path,branch,head}});
  const a=request('00000000-0000-4000-8000-0000000000a1','room-a','stream-a','conv-a',wtA,'room/a',headA,'instruction-a');
  const b=request('00000000-0000-4000-8000-0000000000b2','room-b','stream-b','conv-b',wtB,'room/b',headB,'instruction-b');
  try{
    const [ra,rb]=await Promise.all([fetch(`${base}/api/bridge/requests`,{method:'POST',headers,body:JSON.stringify(a)}),fetch(`${base}/api/bridge/requests`,{method:'POST',headers,body:JSON.stringify(b)})]);
    const [va,vb]=await Promise.all([ra.json(),rb.json()]);assert.equal(ra.status,201,`A=${JSON.stringify(va)} B=${JSON.stringify(vb)}`);assert.equal(rb.status,201,`A=${JSON.stringify(va)} B=${JSON.stringify(vb)}`);
    assert.notEqual(va.run.runId,vb.run.runId);assert.equal(va.run.repositoryPath,wtA);assert.equal(vb.run.repositoryPath,wtB);assert.equal(va.run.branchAtStart,'room/a');assert.equal(vb.run.branchAtStart,'room/b');
    const factBody=(roomId,workstreamId,path)=>({projectId:'shared-project',projectName:'Shared Project',repositoryIdentity:'owner/repo',repositoryPath:path,roomId,workstreamId});
    const [fa,fb]=await Promise.all([fetch(`${base}/api/room-facts`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(factBody('room-a','stream-a',wtA))}).then(r=>r.json()),fetch(`${base}/api/room-facts`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(factBody('room-b','stream-b',wtB))}).then(r=>r.json())]);
    const runtimeRunId=facts=>facts.facts.executor.value.activeLease?.runId??facts.facts.executor.value.latestRun?.runId??null;
    assert.equal(runtimeRunId(fa),va.run.runId);assert.equal(runtimeRunId(fb),vb.run.runId);assert.notEqual(runtimeRunId(fa),runtimeRunId(fb));assert.equal(fa.facts.work.value.workPackages.length,1);assert.equal(fb.facts.work.value.workPackages.length,1);assert.equal(fa.facts.work.value.tasks[0].roomId,'room-a');assert.equal(fb.facts.work.value.tasks[0].roomId,'room-b');
    const [pa,pb]=await Promise.all([waitForBridge(base,a.requestId,headers),waitForBridge(base,b.requestId,headers)]);
    assert.equal(pa.request.repositoryPath,wtA);assert.equal(pb.request.repositoryPath,wtB);assert.equal(pa.run.repositoryPath,wtA);assert.equal(pb.run.repositoryPath,wtB);assert.match(pa.delivery.content,new RegExp(wtA.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));assert.match(pb.delivery.content,new RegExp(wtB.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));assert.doesNotMatch(pa.delivery.content,/instruction-b/);assert.doesNotMatch(pb.delivery.content,/instruction-a/);
    const claim=async id=>fetch(`${base}/api/bridge/requests/${id}/claim`,{method:'POST',headers,body:JSON.stringify({bridgeInstanceId:'bridge-v55'})}).then(r=>r.json());
    const [ca,cb]=await Promise.all([claim(a.requestId),claim(b.requestId)]);
    const receipt=async(id,c)=>fetch(`${base}/api/bridge/requests/${id}/receipt`,{method:'POST',headers,body:JSON.stringify({claimId:c.claim.claimId,outcome:'DELIVERED',conversationId:c.delivery.conversationId,contentSha256:c.delivery.contentSha256})});
    const [rpa,rpb]=await Promise.all([receipt(a.requestId,ca),receipt(b.requestId,cb)]);assert.equal(rpa.status,200);assert.equal(rpb.status,200);
    const [doneA,doneB]=await Promise.all([fetch(`${base}/api/bridge/requests/${a.requestId}`,{headers}).then(r=>r.json()),fetch(`${base}/api/bridge/requests/${b.requestId}`,{headers}).then(r=>r.json())]);
    assert.equal(doneA.bridge.state.deliveryState,'DELIVERED');assert.equal(doneB.bridge.state.deliveryState,'DELIVERED');assert.equal(doneA.bridge.request.conversationId,'conv-a');assert.equal(doneB.bridge.request.conversationId,'conv-b');
  }finally{await new Promise(resolve=>server.close(resolve));rmSync(root,{recursive:true,force:true});}
});
