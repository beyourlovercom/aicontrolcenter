import assert from 'node:assert/strict';
import {monitorRuntimeState,reconcileProcessExit,STARTUP_TIMEOUT_MS,type RuntimeState} from './runtimeManager.ts';

const base=():RuntimeState=>({runId:'run',workPackageId:'AICC-X-001',authorizationId:'auth',authoritySha:'sha',branch:'feature/x',startingHeadSha:'head',pid:42,threadId:null,phase:'STARTING',currentTask:'',latestEvent:'',startedAt:new Date(0).toISOString(),lastActivityAt:new Date(0).toISOString(),events:[]});
const startup=monitorRuntimeState(base(),STARTUP_TIMEOUT_MS+1,()=>true);assert.equal(startup.healthWarning,'STARTUP_TIMEOUT');assert.equal(startup.phase,'STARTING','timeout warns without fabricating failure');
const exited=monitorRuntimeState(base(),1,()=>false);assert.equal(exited.phase,'FAILED');assert.equal(exited.failure,'PROCESS_EXITED_BEFORE_THREAD_STARTED');assert.equal(exited.pidAlive,false);
const runningBase:RuntimeState={...base(),phase:'RUNNING',threadId:'thread-1'};const deadRunning=monitorRuntimeState({...runningBase},1,()=>false);assert.equal(deadRunning.phase,'FAILED');assert.equal(deadRunning.failure,'PROCESS_EXITED_UNEXPECTEDLY');
const stopping:RuntimeState={...base(),phase:'STOPPING',threadId:'thread-1'};const recovered=monitorRuntimeState(stopping,1,()=>false);assert.equal(recovered.phase,'RECOVERY_REQUIRED');assert.equal(recovered.failure,'STALE_PID_LOCK_RECOVERED');
const completedFromEvent:RuntimeState={...runningBase,terminalEventObserved:true};const preserved=monitorRuntimeState(completedFromEvent,1,()=>false);assert.equal(preserved.phase,'COMPLETED','terminal event outranks dead PID fallback');assert.equal(preserved.failure,undefined);
const closed=reconcileProcessExit({...runningBase,terminalEventObserved:true},0);assert.equal(closed.phase,'COMPLETED');assert.equal(closed.exitCode,0);assert.equal(closed.processExitObserved,true);
const negative=reconcileProcessExit({...runningBase,terminalEventObserved:true,finalAgentMessage:'GPT_BRIDGE_001B_ROUND2_FINAL_E2E_NOT_VERIFIED'},0);assert.equal(negative.phase,'COMPLETED','negative task finding does not imply process failure');
const abandoned=monitorRuntimeState({...runningBase,terminalEventObserved:false},1,()=>false);assert.equal(abandoned.failure,'PROCESS_EXITED_UNEXPECTEDLY');
const nonZero=reconcileProcessExit({...runningBase},2);assert.equal(nonZero.phase,'FAILED');assert.equal(nonZero.exitCode,2);
console.log('runtime health contract tests passed');
