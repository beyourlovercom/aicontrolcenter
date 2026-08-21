import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {finalizeCanonicalResult,type RuntimeState} from './runtimeManager.ts';

const base:RuntimeState={runId:'run-phase4-1',workPackageId:'AICC-V2-GPT-AICC-CODEX-CLOSED-LOOP-001',authorizationId:'pass-through',authoritySha:'NOT_APPLICABLE',branch:'rebuild/aicc-v2',startingHeadSha:'head',pid:null,threadId:'thread-1',phase:'COMPLETED',currentTask:'done',latestEvent:'turn.completed',startedAt:'2026-08-14T00:00:00.000Z',lastActivityAt:'2026-08-14T00:01:00.000Z',instructionId:'instruction-phase4',originConversationId:'conversation-1',originMessageId:'message-1',originBlockId:'block-1',events:[]};
const raw='Codex final output is preserved exactly.\nCODEX_RESULT: PASS\nCODEX_REASON: explicit completion';
const completed=finalizeCanonicalResult({...base,finalAgentMessage:raw});
assert.ok(completed.canonicalResult,'terminal final message creates one canonical result');
assert.equal(completed.canonicalResult?.rawResult,raw);
assert.equal(completed.canonicalResult?.executionId,base.runId);
assert.equal(completed.canonicalResult?.instructionId,base.instructionId);
assert.equal(completed.canonicalResult?.originConversationId,'conversation-1');
assert.equal(completed.canonicalResult?.originMessageId,'message-1');
assert.equal(completed.canonicalResult?.originBlockId,'block-1');
assert.equal(completed.canonicalResult?.codexResult,undefined,'AICC does not classify the Codex payload');
assert.equal(completed.canonicalResult?.codexReason,undefined,'AICC does not extract or rewrite a Codex reason');
const first=JSON.stringify(completed.canonicalResult);
finalizeCanonicalResult(completed,'2026-08-14T00:02:00.000Z');
assert.equal(JSON.stringify(completed.canonicalResult),first,'duplicate completion observation is idempotent');
assert.equal(completed.canonicalResult?.resultId,'result-run-phase4-1');
assert.equal(completed.canonicalResult?.resultHash?.length,64);

const blocked=finalizeCanonicalResult({...base,runId:'run-phase4-blocked',phase:'FAILED',finalAgentMessage:'Codex explicitly stopped here.\nCODEX_RESULT: BLOCKED'});
assert.equal(blocked.canonicalResult?.rawResult,'Codex explicitly stopped here.\nCODEX_RESULT: BLOCKED','AICC preserves a FAIL/blocked-looking payload verbatim');
const transportFailure=finalizeCanonicalResult({...base,runId:'run-phase4-transport-failure',phase:'FAILED',failure:'PROCESS_EXIT_NONZERO'});
assert.equal(transportFailure.canonicalResult,undefined,'transport failure does not fabricate a Codex result');
const streaming=finalizeCanonicalResult({...base,runId:'run-phase4-streaming',phase:'RUNNING',finalAgentMessage:'partial stream'});
assert.equal(streaming.canonicalResult?.rawResult,'partial stream','run lifecycle cannot gate an existing Codex result');

const runtime=readFileSync('/Users/a/AI/007/AIcontrolcenter/src/lib/runtimeManager.ts','utf8');
const supervisor=readFileSync('/Users/a/AI/007/AIcontrolcenter/scripts/aicc-run-supervisor.ts','utf8');
const workspace=readFileSync('/Users/a/AI/007/AIcontrolcenter/src/components/entity/RuntimeWorkspace.svelte','utf8');
const app=readFileSync('/Users/a/AI/007/AIcontrolcenter/src/App.svelte','utf8');
assert.match(runtime,/AICC_EXECUTION_RESULT_V1/);
assert.match(supervisor,/finalizeCanonicalResult\(state/);
assert.match(workspace,/canonicalResult\?\.rawResult/);
assert.match(app,/canonicalResult\?\.rawResult/);
assert.doesNotMatch(app,/navigator\.clipboard[^\n]*finalAgentMessage/);
console.log('phase 4 canonical result matrix passed');
