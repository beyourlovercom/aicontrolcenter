import assert from 'node:assert/strict';
import {buildRuntimeDiagnostic} from './runtimeDiagnostics.ts';

const runtime=(overrides:any={})=>({runId:'run-diagnostic',pid:10044,pidAlive:false,processAlive:false,supervisorPidAlive:false,threadId:'01a01448-eb47-7101-8853-822f62d27728',phase:'FAILED',currentTask:'',latestEvent:'',startedAt:'2026-01-01T00:00:00Z',lastActivityAt:'2026-01-01T00:00:01Z',processExitObserved:true,processCloseObserved:true,exitCode:1,failure:'PROCESS_EXIT_NONZERO',stderr:'failed to record rollout items:\nthread 01a01448-eb47-7101-8853-822f62d27728 not found',...overrides} as any);

const codex=buildRuntimeDiagnostic({status:'FAILED'},runtime());
assert.equal(codex?.diagnosticOrigin,'UNKNOWN');
assert.equal(codex?.diagnosticCode,'UNKNOWN');
assert.equal(codex?.processExitCode,1);
assert.match(codex?.stderr??'',/failed to record rollout items/);
assert.equal(codex?.threadId,'01a01448-eb47-7101-8853-822f62d27728');

const conflict=buildRuntimeDiagnostic({status:'FAILED'},runtime({phase:'RUNNING',pidAlive:true,processAlive:true,processExitObserved:false,processCloseObserved:false,exitCode:null}));
assert.equal(conflict?.diagnosticOrigin,'UNKNOWN');
assert.equal(conflict?.diagnosticCode,'UNKNOWN');
assert.equal(conflict?.summary,'暂无 Codex 诊断');

const blocked=buildRuntimeDiagnostic({status:'BLOCKED',blockedReason:'等待 GitHub 授权',blockedCode:'ENVIRONMENT_CREDENTIAL_REQUIRED'});
assert.equal(blocked?.diagnosticOrigin,'UNKNOWN');
assert.equal(blocked?.diagnosticCode,'UNKNOWN');
assert.equal(blocked?.requiredAction,'NOT_AVAILABLE');

const unknown=buildRuntimeDiagnostic({status:'BLOCKED'});
assert.equal(unknown?.diagnosticOrigin,'UNKNOWN');
assert.equal(unknown?.blockedReason,null);
assert.equal(unknown?.confidence,'UNKNOWN');

const stale=buildRuntimeDiagnostic({status:'RUNNING'},runtime({phase:'RUNNING',pidAlive:false,processAlive:false,supervisorPidAlive:false,processExitObserved:false,processCloseObserved:false,exitCode:null}));
assert.equal(stale?.diagnosticCode,'UNKNOWN');
const reconciled=buildRuntimeDiagnostic({status:'FAILED'},runtime({phase:'FAILED',startupTransitions:['DEAD_PROCESS_RECONCILED'],failure:'PROCESS_EXITED',processExitObserved:false,processCloseObserved:false,exitCode:null}));
assert.equal(reconciled?.diagnosticCode,'UNKNOWN');
const explicit=buildRuntimeDiagnostic({status:'FAILED',codexDiagnosis:{code:'CODEX_EXPLICIT',summary:'raw diagnosis',action:'owner action',confidence:'PROVEN'}},runtime());
assert.equal(explicit?.diagnosticOrigin,'CODEX');
assert.equal(explicit?.diagnosticCode,'CODEX_EXPLICIT');
assert.equal(explicit?.summary,'raw diagnosis');
assert.equal(explicit?.requiredAction,'owner action');
console.log('runtime diagnostics read model matrix passed');
