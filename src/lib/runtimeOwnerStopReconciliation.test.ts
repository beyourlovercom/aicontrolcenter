import assert from 'node:assert/strict';
import {monitorRuntimeState,type RuntimeState} from './runtimeManager.ts';

const runtime=(runId:string):RuntimeState=>({runId,workPackageId:'WP',authorizationId:'auth',authoritySha:'sha',branch:'branch',startingHeadSha:'head',pid:98209,supervisorPid:98127,pidAlive:true,processAlive:true,supervisorPidAlive:true,ptySessionId:`pty-${runId}`,threadId:'thread',phase:'STOPPING',currentTask:'Codex 进程运行中',latestEvent:'process.spawned',startedAt:'2026-08-20T09:33:00.000Z',lastActivityAt:'2026-08-20T09:33:56.000Z',events:['process.spawned'],stopRequested:true,stopReason:'OWNER_STOPPED'});

const stopped=monitorRuntimeState(runtime('run-owner-stop'),Date.parse('2026-08-20T09:33:57.000Z'),()=>false);
assert.equal(stopped.phase,'STOPPED');
assert.equal(stopped.processAlive,false);
assert.equal(stopped.pidAlive,false);
assert.equal(stopped.stopReason,'OWNER_STOPPED');
assert.notEqual(stopped.currentTask,'Codex 进程运行中');
assert.notEqual(stopped.latestEvent,'process.spawned');
assert.equal(stopped.exitCode,undefined);
assert.equal(stopped.processExitObserved,undefined);
assert.equal(stopped.processCloseObserved,undefined);

const other=monitorRuntimeState(runtime('run-other'),Date.parse('2026-08-20T09:33:57.000Z'),()=>true);
assert.equal(other.runId,'run-other');
assert.equal(other.phase,'STOPPING');
assert.equal(other.processAlive,true);
assert.equal(other.pidAlive,true);

console.log('runtime Owner Stop terminal reconciliation tests passed');
