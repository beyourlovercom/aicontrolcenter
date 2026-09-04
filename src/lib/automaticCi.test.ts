import assert from 'node:assert/strict';
import {completeAutomaticCi,createAutomaticCiExecution,projectAutomaticCi,type CiRequestStore} from './automaticCi.ts';
const store:CiRequestStore={executions:[],ci:[]};
assert.equal(createAutomaticCiExecution({deliveryContextId:'dc',repository:'org/repo',provider:'actions',status:'READY_FOR_CI'},store),null);
const first=createAutomaticCiExecution({deliveryContextId:'dc',repository:'org/repo',prNumber:4,headSha:'A',provider:'actions',status:'READY_FOR_CI'},store)!;const same=createAutomaticCiExecution({deliveryContextId:'dc',repository:'org/repo',prNumber:4,headSha:'A',provider:'actions',status:'READY_FOR_CI'},store)!;assert.equal(same.ci_execution_id,first.ci_execution_id);assert.equal(store.executions.length,1);
completeAutomaticCi(first,store,{status:'COMPLETED',conclusion:'SUCCESS',workflow:'checks'});assert.equal(projectAutomaticCi(first,'A',store)?.current_for_head,true);assert.equal(projectAutomaticCi(first,'B',store)?.status,'STALE_FOR_CURRENT_HEAD');
const next=createAutomaticCiExecution({deliveryContextId:'dc',repository:'org/repo',prNumber:4,headSha:'B',provider:'actions',status:'READY_FOR_CI'},store)!;assert.notEqual(next.ci_execution_id,first.ci_execution_id);
const failed=createAutomaticCiExecution({deliveryContextId:'dc',repository:'org/repo',prNumber:5,headSha:'C',provider:'actions',status:'READY_FOR_CI'},store)!;completeAutomaticCi(failed,store,{status:'FAILED',conclusion:'NOT_AVAILABLE',workflow:'checks',failureReason:'CI unavailable'});assert.equal(failed.status,'FAILED');assert.equal(store.ci.length,1);
console.log('automatic CI integration matrix passed');
