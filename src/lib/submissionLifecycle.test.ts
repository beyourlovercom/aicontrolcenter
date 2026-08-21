import assert from 'node:assert/strict';
import {acknowledgePendingSubmission,autoLoopTransportFailure,createPendingSubmission,durableAckIdentity,hasExecutionIdentity,isExtensionContextUsable,markSubmissionUnconfirmed,newSubmissionId,reconcilePendingSubmission,recoverSubmissionAfterReload,stateAfterDurableAck,submissionPayloadHash,SUBMISSION_ACK_TIMEOUT_MS,SUBMISSION_STATES,transitionSubmission} from './submissionLifecycle.ts';

assert.deepEqual(SUBMISSION_STATES.slice(0, 8), ['IDLE','SUBMITTING_LOCAL','TRANSPORT_SENT','AICC_ACCEPTED','RUN_CREATED','RUNNING','COMPLETED','FAILED']);
assert.equal(SUBMISSION_ACK_TIMEOUT_MS > 0, true);
assert.equal(transitionSubmission('IDLE','SUBMITTING_LOCAL'), 'SUBMITTING_LOCAL');
assert.equal(transitionSubmission('TRANSPORT_SENT','SUBMISSION_STALLED'), 'SUBMISSION_STALLED');
assert.equal(transitionSubmission('SUBMISSION_STALLED','AICC_ACCEPTED'), 'AICC_ACCEPTED');
assert.equal(transitionSubmission('SUBMISSION_STALLED','RUNNING'), 'RUNNING');
assert.equal(transitionSubmission('SUBMISSION_STALLED','COMPLETED'), 'COMPLETED');
assert.throws(() => transitionSubmission('SUBMITTING_LOCAL','RUNNING'), /INVALID_SUBMISSION_TRANSITION/);
assert.equal(isExtensionContextUsable({runtime:{id:'extension',sendMessage:()=>{}}}), true);
assert.equal(isExtensionContextUsable({runtime:{sendMessage:()=>{}}}), false);
assert.equal(isExtensionContextUsable(null), false);

const accepted = durableAckIdentity({item:{id:'submission-1',submissionId:'submission-1',taskId:'task-1',instruction:{instructionId:'instruction-1'}}});
assert.deepEqual(accepted, {submissionId:'submission-1',instructionId:'instruction-1',taskId:'task-1',executionId:undefined,runId:undefined});
assert.equal(durableAckIdentity({item:{id:'submission-2',instruction:{instructionId:'instruction-2'}}}), null);
assert.equal(stateAfterDurableAck(accepted!), 'AICC_ACCEPTED');
assert.equal(stateAfterDurableAck({...accepted!,executionId:'execution-1',runId:'run-1'}, 'IMPORT_AND_RUN'), 'RUN_CREATED');
assert.equal(hasExecutionIdentity({executionId:'execution-1',runId:'run-1'}), true);
assert.equal(hasExecutionIdentity({executionId:'execution-1'}), false);
assert.equal(recoverSubmissionAfterReload({submissionId:'submission-3',state:'SUBMITTING_LOCAL'}).state, 'IDLE');
assert.equal(recoverSubmissionAfterReload({submissionId:'submission-4',state:'RUNNING',taskId:'task-4',executionId:'execution-4',runId:'run-4'}).state, 'RUNNING');
assert.notEqual(newSubmissionId(100,0.1), newSubmissionId(100,0.2));
const pending=createPendingSubmission({submissionId:'submission-pending',instructionId:'instruction-pending',payload:'AICC_EXECUTION_V1\n\nINSTRUCTION_END',source:'GPT_BLOCK',conversationId:'conversation-1',createdAt:'2026-08-16T00:00:00.000Z'});
assert.deepEqual(pending,{submission_id:'submission-pending',instruction_id:'instruction-pending',payload_hash:submissionPayloadHash('AICC_EXECUTION_V1\nINSTRUCTION_END'),source:'GPT_BLOCK',conversation_id:'conversation-1',created_at:'2026-08-16T00:00:00.000Z',ack_state:'PENDING'},'pending identity is complete before transport');
assert.equal(markSubmissionUnconfirmed(pending).ack_state,'UNCONFIRMED','watchdog means acknowledgement remains unconfirmed');
const acknowledged=acknowledgePendingSubmission(pending,{submissionId:'submission-pending',instructionId:'instruction-pending',taskId:'task-1',inboxId:'inbox-1',executionId:'execution-1',runId:'run-1'});
assert.deepEqual(acknowledged,{...pending,ack_state:'ACKNOWLEDGED',inbox_id:'inbox-1',task_id:'task-1',execution_id:'execution-1',run_id:'run-1'});
const candidates=[
  {id:'inbox-weak',submissionId:'other',payloadHash:pending.payload_hash,instruction:{instructionId:'instruction-pending',sourceType:'GPT_BLOCK',originContext:{conversationId:'conversation-1'}}},
  {id:'inbox-strong',submissionId:'submission-pending',payloadHash:'different',instruction:{instructionId:'different',sourceType:'GPT_BLOCK'}}
];
assert.equal(reconcilePendingSubmission(pending,candidates)?.id,'inbox-strong','submission identity wins over payload fallback');
assert.equal(reconcilePendingSubmission({...pending,submission_id:'missing'},candidates)?.id,'inbox-weak','instruction plus payload and conversation reconciles a lost acknowledgement');
assert.equal(reconcilePendingSubmission({...pending,submission_id:'missing',payload_hash:'different'},candidates),null,'different payload cannot false-deduplicate');
assert.deepEqual(autoLoopTransportFailure(), {state:'PAUSED',label:'AUTO LOOP · BRIDGE INVALIDATED',code:'EXTENSION_CONTEXT_INVALIDATED'});
console.log('AICC submission lifecycle contract matrix passed');
