import assert from 'node:assert/strict';
import {launchCodexRuntime} from './codexRuntimeLauncher.ts';
let launches=0;let receivedArgs:string[]=[];const fakeSpawn=((_:string,args:string[])=>{launches++;receivedArgs=args;return {pid:7001,unref(){}}}) as any;
const request={executionId:'m6-launcher-1',instructionId:'instruction-1',repository:'/repo',branch:'delivery/canary',sandbox:'workspace-write' as const,specFile:'/tmp/spec.json',supervisorScript:'/repo/scripts/aicc-run-supervisor.ts'};
const started=launchCodexRuntime(request,{available:true,spawnProcess:fakeSpawn});assert.equal(started.runtimeState,'STARTING');assert.equal(started.processId,7001);assert.equal(launches,1);
assert.deepEqual(receivedArgs.slice(-2),[request.supervisorScript,request.specFile],'launcher executes the supervisor and passes the spec as its argument');
const duplicate=launchCodexRuntime(request,{available:true,spawnProcess:fakeSpawn});assert.equal(duplicate.failure,'CODEX_LAUNCH_FAILED');assert.equal(launches,1);
const unavailable=launchCodexRuntime({...request,executionId:'m6-launcher-unavailable'},{available:false});assert.equal(unavailable.runtimeState,'FAILED');assert.equal(unavailable.failure,'CODEX_RUNTIME_UNAVAILABLE');
console.log('codex runtime launcher matrix passed');
