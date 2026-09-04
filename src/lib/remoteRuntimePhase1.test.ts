import assert from 'node:assert/strict';
import {createRemoteExecutionEnvelope,ExactlyOnceExecutionClaims,RemoteEventStore} from './remoteRuntimeProtocol.ts';
import {executeClaude} from './claudeExecutionAdapter.ts';
import {readFileSync} from 'node:fs';
import {EventEmitter} from 'node:events';

assert.deepEqual(['LOCAL_CODEX','REMOTE_CLAUDE'],['LOCAL_CODEX','REMOTE_CLAUDE']);
const envelope=createRemoteExecutionEnvelope({executionId:'exec-1',runnerId:'US-WAREHOUSE-01',provider:'CLAUDE_CODE',repositoryRoot:process.cwd(),instruction:'Read package.json and return only the package name.',createdAt:'now'});assert.equal(envelope.protocolVersion,'AICC_REMOTE_RUNTIME_V1');
const claims=new ExactlyOnceExecutionClaims(),first=claims.claim('exec-1',envelope.runnerId),duplicate=claims.claim('exec-1',envelope.runnerId);assert.equal(first.accepted,true);assert.equal(duplicate.accepted,false);claims.update('exec-1','COMPLETED',{name:JSON.parse(readFileSync('package.json','utf8')).name});assert.equal(claims.claim('exec-1',envelope.runnerId).accepted,false);
const store=new RemoteEventStore();for(const eventType of ['QUEUED','CLAIMED','SPAWNED','RUNNING','OUTPUT','EXITED','RESULT_SAVED'] as const)store.append({executionId:'exec-1',runnerId:envelope.runnerId,eventType,timestamp:'now',payload:{}});assert.deepEqual(store.all('exec-1').map(event=>event.sequenceId),[1,2,3,4,5,6,7]);assert.deepEqual(store.after('exec-1',4).map(event=>event.sequenceId),[5,6,7]);
let spawns=0;const fakeChild:any=new EventEmitter();fakeChild.pid=42;fakeChild.stdout={on:(_event:string,handler:(chunk:string)=>void)=>{handler('{"name":"ai-control-center"}');return fakeChild}};fakeChild.stderr={on:(_event:string,handler:(chunk:string)=>void)=>{handler('warning');return fakeChild}};
const processFacts=await executeClaude('Read package.json and return only the package name.',process.cwd(),{spawn:(_command:string,_args:string[])=>{spawns++;queueMicrotask(()=>fakeChild.emit('close',0));return fakeChild}} as any);assert.equal(spawns,1);assert.match(processFacts.stdout,/ai-control-center/);assert.equal(processFacts.stderr,'warning');assert.equal(processFacts.exitCode,0);assert.equal(processFacts.pid,42);assert.ok(processFacts.startedAt&&processFacts.completedAt);
console.log('remote runtime Phase 1 canary passed');
