import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectTaskResult,taskResultNeedsReconciliation} from './taskResultProjection.ts';
import type {CanonicalExecutionResult,RuntimeRecord} from './model/entityTypes.ts';

const result=(runId:string,text=`result for ${runId}`):CanonicalExecutionResult=>({version:'AICC_EXECUTION_RESULT_V1',executionId:runId,projectId:'aicc',repositoryIdentity:'aicc-repo',aiccStatus:'RESULT_RECEIVED',rawResult:text,receivedAt:'2026-08-16T02:15:45.361Z',resultId:`result-${runId}`,resultHash:`hash-${runId}`,returnState:'RESULT_READY'});
const runtime=(runId:string,phase='COMPLETED',canonicalResult?:CanonicalExecutionResult):RuntimeRecord=>({runId,projectId:'aicc',repositoryIdentity:'aicc-repo',workPackageId:'AICC-V2-GPT-CODEX-BRIDGE-001',authorizationId:'pass-through',authoritySha:'NOT_APPLICABLE',branch:'rebuild/aicc-v2',startingHeadSha:'head',pid:null,threadId:'thread',phase,currentTask:'done',latestEvent:'turn.completed',startedAt:'2026-08-16T02:00:00.000Z',lastActivityAt:'2026-08-16T02:15:45.361Z',canonicalResult});
const task=(runId:string,origin:string,status='COMPLETED')=>({taskId:`task-${origin}`,executionId:runId,runId,status,origin,provider:'codex'});
const outbox=(runId:string,canonicalResult:CanonicalExecutionResult)=>({executionId:runId,runId,report:{executionId:runId,runId,canonicalResult}});

const pending=projectTaskResult({task:task('run-race','GPT_AUTO_CONTROL_LOOP'),runtime:runtime('run-race'),outbox:[],reconciliationPending:true});
assert.equal(pending.state,'NOT_AVAILABLE');
assert.equal(taskResultNeedsReconciliation(pending),true);
const resolved=projectTaskResult({task:task('run-race','GPT_AUTO_CONTROL_LOOP'),runtime:runtime('run-race', 'COMPLETED',result('run-race')),outbox:[],reconciliationPending:true});
assert.equal(resolved.state,'RESULT_AVAILABLE');
assert.equal(resolved.source,'EXACT_RUN_RUNTIME');
assert.equal(taskResultNeedsReconciliation(resolved),false);

const exactRuntime=result('run-exact','exact runtime result');
const staleEntity=result('run-other','stale entity result');
const outboxRecords=[outbox('run-other',staleEntity),outbox('run-exact',result('run-exact','outbox fallback'))];
const exactWins=projectTaskResult({task:task('run-exact','GPT_BLOCK'),runtime:runtime('run-exact','COMPLETED',exactRuntime),outbox:outboxRecords});
assert.equal(exactWins.result?.rawResult,'exact runtime result');
assert.equal(exactWins.resultId,exactRuntime.resultId);
assert.equal(outboxRecords.length,2,'projection never creates or duplicates Outbox records');
const wrongRun=projectTaskResult({task:task('run-exact','GPT_BLOCK'),runtime:runtime('run-other','COMPLETED',staleEntity),outbox:[outbox('run-other',staleEntity)]});
assert.equal(wrongRun.result,null);
assert.equal(wrongRun.state,'NOT_AVAILABLE','a missing exact Codex result remains NOT_AVAILABLE');
assert.equal(projectTaskResult({task:{taskId:'task-no-result-expected',status:'COMPLETED',provider:'external'}}).state,'NOT_AVAILABLE');
const mismatchedIdentity=projectTaskResult({task:{...task('run-distinct','GPT_BLOCK'),executionId:'execution-distinct'},runtime:runtime('run-distinct','COMPLETED',result('run-distinct'))});
assert.equal(mismatchedIdentity.result,null,'Task executionId and runId must both match the canonical result identity');

for(const origin of ['CLIPBOARD_DIRECT','GPT_BLOCK','GPT_AUTO_CONTROL_LOOP']){
  const runId=`run-${origin.toLowerCase()}`;
  const projection=projectTaskResult({task:task(runId,origin),outbox:[outbox(runId,result(runId))]});
  assert.equal(projection.state,'RESULT_AVAILABLE');
  assert.equal(projection.source,'EXACT_RUN_OUTBOX');
}

const failedResult=projectTaskResult({task:task('run-failed','GPT_BLOCK','FAILED'),runtime:runtime('run-failed','FAILED',result('run-failed','failure evidence'))});
assert.equal(failedResult.state,'RESULT_AVAILABLE');
assert.equal(projectTaskResult({task:task('run-failed-empty','GPT_BLOCK','FAILED'),runtime:runtime('run-failed-empty','FAILED')}).state,'NOT_AVAILABLE');

const historicalRun='run-1786838821371-b00v66';
const historical=projectTaskResult({task:{...task(historicalRun,'GPT_AUTO_CONTROL_LOOP'),taskId:'task-m8.2.1.8-gpt-auto-control-loop-uat-001'},runtime:runtime(historicalRun,'COMPLETED',result(historicalRun,'existing canonical result'))});
assert.equal(historical.resultId,`result-${historicalRun}`);
assert.equal(historical.result?.rawResult,'existing canonical result');

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const detail=readFileSync(new URL('../components/GlobalTaskDetail.svelte',import.meta.url),'utf8');
const vite=readFileSync(new URL('../../vite.config.ts',import.meta.url),'utf8');
assert.match(app,/projectTaskResult\(\{task:selectedTask,runtime:selectedTaskRuntime,outbox:bridgeOutbox,reconciliationPending:selectedTaskResultReconciliationPending\}\)/);
assert.match(app,/TASK_RESULT_RECONCILIATION_MAX_ATTEMPTS=6/);
assert.match(app,/\/api\/codex\/runtime\?runId=/);
assert.match(app,/if\(!task\|\|!runId\)return;\s*try\{\s*const runtimeResult=await request\(`\/api\/codex\/runtime\?runId=\$\{encodeURIComponent\(runId\)\}`\);[\s\S]*?const initial=projectTaskResult\(\{task,runtime:selectedTaskExactRuntime\?\?runtimeHistory/,'a selected Task reads its exact durable Runtime before canonical-result reconciliation can short-circuit');
assert.match(detail,/>NOT_AVAILABLE<\/p>/);
assert.match(detail,/resultProjection\?\.result/);
assert.match(vite,/searchParams\.get\('runId'\)/);
assert.match(vite,/readRuntimeByRunIdReadOnly\(runId\)/);
console.log('task exact-run canonical result projection matrix passed');
