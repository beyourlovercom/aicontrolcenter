import assert from 'node:assert/strict';
import {applyHealthObservation,beginRecoveryEpoch,classifyLocalService,HEALTH_FAILURE_THRESHOLD,isCanonicalListener,manualRestart,MAX_RECOVERY_ATTEMPTS,reconnectEffect,recoveryActions,type ServiceObservation,type SupervisorHealthState} from './localServiceRecovery.ts';

const root=process.cwd();
const canonical={pid:101,command:`node ${root}/node_modules/.bin/vite --host 127.0.0.1`,cwd:root};
const observe=(overrides:Partial<ServiceObservation>={}):ServiceObservation=>({listener:canonical,health:{responded:true,canonicalIdentity:true,ok:true},consecutiveHealthFailures:0,repositoryRoot:root,...overrides});
const state=(overrides:Partial<SupervisorHealthState>={}):SupervisorHealthState=>({state:'PROCESS_ALIVE_HEALTHY',managedPid:101,consecutiveFailures:0,recoveryEpoch:0,recoveryAttempts:0,...overrides});

assert.equal(classifyLocalService(observe({listener:null})),'NO_SERVICE');
assert.equal(classifyLocalService(observe()),'HEALTHY_CANONICAL_SERVICE');
assert.equal(classifyLocalService(observe({health:{responded:false,canonicalIdentity:false,ok:false,reason:'ETIMEDOUT'},consecutiveHealthFailures:1})),'STARTING');
assert.equal(classifyLocalService(observe({health:{responded:false,canonicalIdentity:false,ok:false,reason:'ECONNREFUSED'},consecutiveHealthFailures:HEALTH_FAILURE_THRESHOLD})),'PROCESS_ALIVE_HEALTH_DEGRADED');
assert.equal(classifyLocalService(observe({listener:{...canonical,cwd:'/tmp/foreign'}})),'FOREIGN_PORT_CONFLICT');
assert.equal(classifyLocalService(observe({listener:{...canonical,command:'python -m http.server 1420'}})),'FOREIGN_PORT_CONFLICT');
assert.equal(isCanonicalListener(observe()),true);

const healthy=applyHealthObservation(state(),{processAlive:true,healthOk:true});
assert.equal(healthy.action,'NONE','PROCESS_ALIVE_HEALTHY_NO_RECOVERY');
assert.equal(healthy.state.state,'HEALTHY');

const dead=applyHealthObservation(state(),{processAlive:false,healthOk:false,reason:'PROCESS_EXITED'});
assert.equal(dead.action,'START_SERVICE','PROCESS_DEAD_RECOVERY');
assert.equal(dead.state.state,'RESTARTING');
assert.equal(dead.state.recoveryAttempts,1);

const belowThreshold=applyHealthObservation(state(),{processAlive:true,healthOk:false,reason:'ETIMEDOUT'});
assert.equal(belowThreshold.action,'RETRY_HEALTH','TRANSIENT_HEALTH_UNRESPONSIVE_REMAINS_DEGRADED');
assert.equal(belowThreshold.state.state,'PROCESS_ALIVE_HEALTH_DEGRADED');
assert.equal(belowThreshold.state.consecutiveFailures,1,'FAILED_HEALTH_DOES_NOT_RESET_CONSECUTIVE_FAILURES');
const threshold=applyHealthObservation(belowThreshold.state,{processAlive:true,healthOk:false,reason:'ETIMEDOUT',managedPidOwned:true});
assert.equal(threshold.action,'TERMINATE_AND_RESTART','THRESHOLD_REMAINS_REACHABLE_FOR_HEALTH_TIMEOUT');
assert.equal(threshold.state.state,'SERVICE_UNHEALTHY');
assert.equal(threshold.state.consecutiveFailures,2);
assert.equal(threshold.state.recoveryAttempts,1);

const timeoutRecovered=applyHealthObservation(threshold.state,{processAlive:true,healthOk:true});
assert.equal(timeoutRecovered.action,'RECOVERED','REPLACEMENT_REQUIRES_HEALTH_SUCCESS');
assert.equal(timeoutRecovered.state.managedPid,101);
assert.equal(timeoutRecovered.state.state,'HEALTHY');

const resetRecovered=applyHealthObservation(threshold.state,{processAlive:true,healthOk:false,reason:'CONNECTION_RESET',managedPidOwned:true});
assert.equal(resetRecovered.action,'TERMINATE_AND_RESTART','CONNECTION_RESET_COUNTS_TOWARD_BOUNDED_RECOVERY');
assert.equal(resetRecovered.state.consecutiveFailures,3);

const unhealthyThreshold=applyHealthObservation({...threshold.state,consecutiveFailures:1},{processAlive:true,healthOk:false,reason:'HTTP_500',managedPidOwned:true});
assert.equal(unhealthyThreshold.action,'TERMINATE_AND_RESTART','NON_TRANSIENT_HEALTH_FAILURE_RETAINS_BOUNDED_RECOVERY');
assert.equal(unhealthyThreshold.state.state,'SERVICE_UNHEALTHY');
assert.equal(unhealthyThreshold.state.recoveryAttempts,2);

const recoveredHealth=applyHealthObservation(unhealthyThreshold.state,{processAlive:true,healthOk:true});
assert.equal(recoveredHealth.action,'RECOVERED','SUCCESSFUL_RESTART_REPORTS_RECOVERED');
assert.equal(recoveredHealth.state.state,'HEALTHY');
assert.equal(recoveredHealth.state.consecutiveFailures,0,'HEALTH_SUCCESS_RESETS_CONSECUTIVE_FAILURES');

const failedAgain=applyHealthObservation(unhealthyThreshold.state,{processAlive:true,healthOk:false,reason:'HTTP_500',managedPidOwned:true});
assert.equal(failedAgain.state.consecutiveFailures,3,'FAILURE_COUNTER_DOES_NOT_RESET_WITHOUT_HEALTH_SUCCESS');
assert.equal(failedAgain.state.lastHealthFailure?.reason,'HTTP_500','HEALTH_FAILURE_REASON_RECORDED');

const unsafe=applyHealthObservation(threshold.state,{processAlive:true,healthOk:false,reason:'ETIMEDOUT',managedPidOwned:false});
assert.equal(unsafe.action,'BLOCKED_UNSAFE_PID','UNRELATED_PID_NOT_TERMINATED');
assert.equal(unsafe.state.state,'RECOVERY_FAILED');

const owned=applyHealthObservation(unhealthyThreshold.state,{processAlive:true,healthOk:false,reason:'HTTP_500',managedPidOwned:true});
assert.equal(owned.action,'TERMINATE_AND_RESTART','UNHEALTHY_MANAGED_PID_TERMINATED');
assert.equal(owned.state.state,'SERVICE_UNHEALTHY');

const listenerMissingButManagedAlive=applyHealthObservation(state(),{processAlive:true,healthOk:false,reason:'UNKNOWN',managedPidOwned:true});
assert.equal(listenerMissingButManagedAlive.state.state,'PROCESS_ALIVE_HEALTH_DEGRADED','LISTENER_MISSING_MANAGED_PID_ALIVE_IS_NOT_HEALTHY');
const listenerMissingThreshold=applyHealthObservation(listenerMissingButManagedAlive.state,{processAlive:true,healthOk:false,reason:'UNKNOWN',managedPidOwned:true});
assert.equal(listenerMissingThreshold.action,'TERMINATE_AND_RESTART','LISTENER_MISSING_MANAGED_PID_REACHES_RECOVERY');

const retryAfterRestart=applyHealthObservation({...threshold.state,state:'RESTARTING',managedPid:null,recoveryAttempts:1},{processAlive:false,healthOk:false,reason:'PROCESS_EXITED'});
assert.equal(retryAfterRestart.action,'START_SERVICE','RESTART_REQUIRES_HEALTH_SUCCESS');
assert.equal(retryAfterRestart.state.recoveryAttempts,2);

const bounded=applyHealthObservation({...state(),state:'RESTARTING',managedPid:null,recoveryAttempts:MAX_RECOVERY_ATTEMPTS},{processAlive:false,healthOk:false,reason:'PROCESS_EXITED'});
assert.equal(bounded.action,'RECOVERY_FAILED','FAILED_RESTART_IS_BOUNDED');
assert.equal(bounded.state.state,'RECOVERY_FAILED','RECOVERY_FAILED_DOES_NOT_LOOP_FOREVER');

const oldEpoch=state({state:'RECOVERY_FAILED',consecutiveFailures:4,recoveryEpoch:2,recoveryAttempts:MAX_RECOVERY_ATTEMPTS,lastHealthFailure:{reason:'ECONNREFUSED'}});
const manual=manualRestart(oldEpoch);
assert.equal(manual.state,'RESTARTING','MANUAL_RESTART_AFTER_FAILURE');
assert.equal(manual.recoveryEpoch,3);
assert.equal(manual.previousEpoch?.recoveryEpoch,2);
assert.equal(manual.previousEpoch?.consecutiveFailures,4);
const epoch=beginRecoveryEpoch(oldEpoch);
assert.equal(epoch.consecutiveFailures,0);
assert.equal(epoch.previousEpoch?.consecutiveFailures,4);

assert.deepEqual(recoveryActions('PROCESS_ALIVE_HEALTH_DEGRADED'),['RETRY_HEALTH_WITH_BACKOFF','THRESHOLD_TO_SERVICE_UNHEALTHY','VERIFY_CANONICAL_IDENTITY','SIGTERM','BOUNDED_WAIT','START_OFFICIAL_SERVICE','POLL_CANONICAL_HEALTH']);
assert.deepEqual(recoveryActions('FOREIGN_PORT_CONFLICT'),['REPORT_PORT_1420_CONFLICT']);
assert.equal(reconnectEffect('STALE_CANONICAL_SERVICE','HEALTHY_CANONICAL_SERVICE').refreshSnapshot,true);
assert.equal(reconnectEffect('STALE_CANONICAL_SERVICE','HEALTHY_CANONICAL_SERVICE').preserveSelection,true);
console.log('local service health recovery tests passed');
