import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';

const root=process.cwd();
const domSource=readFileSync(join(root,'web-adapter/chatgpt-dom.js'),'utf8');
const content=readFileSync(join(root,'web-adapter/chrome-extension-current/content.js'),'utf8');
const registry=readFileSync(join(root,'web-adapter/chrome-extension-current/bridge-action-registry.js'),'utf8');
const autoLoopDomain=readFileSync(join(root,'src/lib/gptAutoControlLoop.ts'),'utf8');
const context:{AICCChatGPTDom?:Record<string,any>;innerWidth:number}={innerWidth:1440};
vm.runInNewContext(domSource,context);
const dom=context.AICCChatGPTDom!;

const labels=['剪贴板发送到 Codex 执行','发送到 Codex 并执行','插入 Codex 结果','发送到 AICC','执行下一步'];
const panelTemplate=content.match(/panel\.innerHTML = '([^']+)'/)?.[1]??'';
const runtimeTemplate=content.match(/section\.innerHTML = '([^']+)'/)?.[1]??'';
let previousIndex=-1;
for(const label of labels){const index=registry.indexOf(label);assert.ok(index>previousIndex,`${label} remains in frozen order`);previousIndex=index;}
assert.equal((registry.match(/actionKey:/g)??[]).length,6,'the revised action registry contains exactly six actions including US-Claude');
assert.doesNotMatch(registry,/插入 AICC 结果|aicc-result/);
assert.match(content,/width:380px/);assert.match(content,/max-width:calc\(100vw - 24px\)/);assert.match(content,/right:16px;bottom:16px/);assert.match(content,/border-radius:13px/);assert.match(content,/data-aicc-collapse/);
assert.doesNotMatch(panelTemplate,/data-aicc-auto-loop-id|Control Loop ID/,'editable loop identity is absent from production UI');
assert.doesNotMatch(content,/function systemControlLoopId|control_loop_id: controlLoopId/,'the display panel cannot generate or override control loop identity');
assert.match(autoLoopDomain,/function systemManagedControlLoopId\(conversation_id: string\)[\s\S]*createHash\('sha256'\)/,'the server domain generates control loop identity from canonical Conversation evidence');
assert.doesNotMatch(panelTemplate,/data-aicc-auto-submit-probe|UAT · Auto Submit Probe|data-aicc-auto-submit-probe-status/,'diagnostic probe UI is absent');
assert.equal((panelTemplate.match(/type=\"checkbox\"/g)??[]).length,2,'auto control has exactly two Owner-facing toggles');
assert.match(panelTemplate,/锁定 GPT 聊天口[\s\S]*开启自动循环/);
assert.match(content,/data-aicc-runtime-result-panel/);assert.match(content,/>运行结果</);assert.match(content,/结果预览/);
assert.match(content,/class="aicc-runtime-status-badge" data-aicc-runtime-status>IDLE</,'compact panel owns the canonical runtime badge');
assert.doesNotMatch(content,/Codex 执行中 · 来源:|Codex 结果已就绪 · 来源:/,'legacy duplicate runtime status is removed');
assert.equal((content.match(/data-aicc-status(?=[ >])/g)??[]).length,1,'one unified live status surface remains');
assert.match(content,/class="aicc-runtime-message" data-aicc-status data-aicc-runtime-error aria-live="polite" hidden/,'action and runtime errors share the Runtime Result surface');
assert.match(content,/source === 'CLIPBOARD_DIRECT' \? '剪贴板' : source/,'clipboard direct receives presentation-only normalization');
assert.match(content,/\.aicc-runtime-id,.aicc-runtime-profile\{overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/,'IDs and run profile remain single-line and overflow-safe');
assert.match(content,/\.aicc-bridge-panel \*\{box-sizing:border-box;min-width:0\}/,'panel descendants cannot force parent overflow');
assert.match(content,/overflow-x:hidden;overflow-y:auto/,'Bridge shell never exposes horizontal scrolling');
assert.match(content,/--aicc-space-section:8px/,'the compact panel uses one shared major-section rhythm');
assert.match(content,/\.aicc-bridge-title\{font-size:19px;line-height:1\.1\}/,'title remains strong without dominating the utility panel');
assert.match(content,/\.aicc-auto-control-box\{gap:6px;padding:9px 12px\}/,'the two-toggle control box remains compact');
assert.match(content,/grid-template-columns:24px 22px minmax\(0,1fr\)/,'all primary actions share compact number, icon, and label columns');
assert.match(content,/\.aicc-primary-actions\{gap:5px\}/,'all six actions use one compact stack gap');
assert.match(content,/data-aicc-action-button\]\{[^}]*height:36px/,'all primary actions share the reference-derived compact height');
assert.match(content,/\.aicc-action-label\{font-size:14px;font-weight:550;line-height:1\}/,'all primary labels share one compact typography contract');
assert.match(content,/\.aicc-bridge-panel \[data-aicc-action-button\]:disabled\{[^}]*opacity:\.48/,'disabled styling changes emphasis without changing geometry');
assert.match(content,/\.aicc-runtime-fields\{[^}]*border:1px solid var\(--aicc-line\)/,'runtime metadata is a bordered table');
assert.match(content,/\.aicc-runtime-row\{grid-template-columns:39% minmax\(0,1fr\);min-height:28px\}/,'runtime table uses the approved label proportion and compact row height');
assert.match(content,/\.aicc-runtime-fields dt,\.aicc-runtime-fields dd\{padding:4px 8px;line-height:1\.2\}/,'runtime cells share compact readable typography');
assert.match(content,/\.aicc-runtime-fields dd\{[^}]*text-overflow:ellipsis;white-space:nowrap/,'runtime values cannot expand the panel');
assert.match(content,/\.aicc-result-actions\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,'two remaining footer actions stay aligned in one row');
assert.match(content,/\.aicc-result-actions button\{[^}]*min-height:34px[^}]*font-size:11px/,'footer controls preserve one-row geometry at compact height');
for(const label of ['复制结果','展开结果'])assert.match(content,new RegExp(`data-aicc-footer-label>${label}`));
assert.match(content,/class="aicc-insert-gpt-footer"[\s\S]*data-aicc-insert-gpt[^>]*>插入 GPT/,'the independent bottom-center GPT insertion control is present');
assert.match(content,/data-aicc-codex-profile-trigger/,'model selector remains in the Runtime Result header');
assert.doesNotMatch(content,/data-aicc-runtime-model|data-aicc-runtime-reasoning/,'separate Model and Reasoning rows are removed');
assert.doesNotMatch(content,/data-aicc-runtime-(?:run-profile|run-id|execution-id)[^>]*>—</,'optional runtime rows have no dash placeholders');
assert.match(content,/data-aicc-runtime-row="run-profile" hidden/);assert.match(content,/data-aicc-runtime-row="execution-id" hidden/);
assert.match(content,/renderOptionalRuntimeField\(section, SELECTORS\.runtimeExecutionId/,'optional Execution ID visibility follows canonical evidence');

const idle=dom.emptyBridgeRuntimeProjection('2026-08-15T00:00:00.000Z');
assert.equal(idle.status,'IDLE');assert.equal(idle.resultState,'NONE');assert.equal(idle.resultText,'');

const submitting=dom.projectBridgeRuntime({previous:{...idle,status:'COMPLETED',runId:'old-run',resultState:'AVAILABLE',resultText:'old result'},transition:'SUBMITTING_LOCAL',sourceType:'CLIPBOARD_DIRECT',reset:true,updatedAt:'2026-08-15T00:00:01.000Z'});
assert.equal(submitting.status,'SUBMITTING_LOCAL');assert.equal(submitting.source,'CLIPBOARD_DIRECT');assert.equal(submitting.resultState,'WAITING');
assert.equal(submitting.runId,null,'a new submission clears the prior run binding immediately');
const running=dom.projectBridgeRuntime({previous:submitting,correlation:{inboxId:'inbox-1',runId:'run-1',sourceType:'CLIPBOARD_DIRECT'},item:{id:'inbox-1',taskId:'task-1',instruction:{instructionId:'instruction-1'},executionId:'execution-1',runId:'run-1'},updatedAt:'2026-08-15T00:00:02.000Z'});
assert.equal(running.status,'RUNNING');assert.equal(running.runId,'run-1');assert.equal(running.resultState,'WAITING');
assert.equal(running.source,'CLIPBOARD_DIRECT','canonical clipboard source is unchanged by presentation mapping');

const runProfile=dom.projectBridgeRuntime({previous:submitting,correlation:{inboxId:'inbox-profile',runId:'run-profile',sourceType:'GPT_BLOCK'},item:{id:'outbox-profile',state:'LAUNCHED',inboxId:'inbox-profile',taskId:'task-profile',instruction:{instructionId:'instruction-profile'},executionId:'execution-profile',runId:'run-profile',model:'gpt-5.6-luna',reasoning_effort:'low',updatedAt:'2026-08-15T00:00:03.000Z'}});
assert.equal(runProfile.model,'gpt-5.6-luna');assert.equal(runProfile.reasoningEffort,'low');
const selectorChanged=dom.projectBridgeRuntime({previous:runProfile,correlation:{inboxId:'inbox-profile',runId:'run-profile',sourceType:'GPT_BLOCK'},updatedAt:'2026-08-15T00:00:04.000Z'});
assert.equal(selectorChanged.model,'gpt-5.6-luna','current selector changes cannot rewrite old run evidence');assert.equal(selectorChanged.reasoningEffort,'low');

const rawResult='GLOBAL_UNBOUND_REAL_UAT = PASS\n当前 branch: rebuild/aicc-v2\n当前时间: 2026-08-15 18:24';
const completedItem={id:'outbox-1',state:'READY',inboxId:'inbox-1',runId:'run-1',executionId:'execution-1',updatedAt:'2026-08-15T00:01:00.000Z',report:{runId:'run-1',executionId:'execution-1',status:'COMPLETED',canonicalResult:{version:'AICC_EXECUTION_RESULT_V1',executionId:'execution-1',resultId:'result-1',resultHash:'hash-1',rawResult}}};
const completed=dom.projectBridgeRuntime({previous:running,correlation:{inboxId:'inbox-1',runId:'run-1',sourceType:'CLIPBOARD_DIRECT'},item:completedItem});
assert.equal(completed.status,'COMPLETED');assert.equal(completed.resultState,'AVAILABLE');assert.equal(completed.resultText,rawResult,'preview projects the exact persisted Codex result');assert.equal(completed.resultId,'result-1');assert.equal(completed.resultHash,'hash-1');assert.equal(completed.executionId,'execution-1');
assert.equal(completed.runId,'run-1','the full canonical Run ID is retained in projection state');

const failedItem={...completedItem,report:{...completedItem.report,status:'FAILED',summary:'Codex runtime exited',canonicalResult:undefined}};
const failed=dom.projectBridgeRuntime({previous:running,correlation:{inboxId:'inbox-1',runId:'run-1',sourceType:'GPT_BLOCK'},item:failedItem});
assert.equal(failed.status,'FAILED');assert.equal(failed.source,'GPT_BLOCK');assert.equal(failed.error,'Codex runtime exited');assert.equal(failed.resultState,'WAITING');

const noTextItem={...completedItem,report:{...completedItem.report,canonicalResult:{...completedItem.report.canonicalResult,rawResult:''}}};
const noText=dom.projectBridgeRuntime({previous:running,correlation:{inboxId:'inbox-1',runId:'run-1',sourceType:'CLIPBOARD_DIRECT'},item:noTextItem});
assert.equal(noText.status,'COMPLETED');assert.equal(noText.resultState,'WAITING','result-ready is false without retrievable text');assert.equal(noText.resultText,'');

const stale=dom.projectBridgeRuntime({previous:running,correlation:{inboxId:'inbox-2',runId:'run-2',sourceType:'CLIPBOARD_DIRECT'},item:completedItem});
assert.equal(stale.status,'RUNNING');assert.equal(stale.runId,'run-2');assert.equal(stale.resultState,'WAITING','an older run result cannot bind to the active run');assert.equal(stale.resultText,'');

const aiccItem={...completedItem,inboxId:'inbox-aicc',taskId:'task-aicc',runId:'run-aicc',report:{runId:'run-aicc',executionId:'execution-aicc',status:'COMPLETED',entityId:'AICC-WP',executionType:'IMPLEMENTATION',gateResult:'PASS',summary:'AICC finished'}};
const aicc=dom.projectBridgeRuntime({correlation:{inboxId:'inbox-aicc',runId:'run-aicc',sourceType:'WEB_BRIDGE'},item:aiccItem});
assert.equal(aicc.status,'COMPLETED');assert.equal(aicc.source,'AICC');assert.equal(aicc.resultState,'AVAILABLE');assert.match(aicc.resultText,/AICC_RUN_REPORT_V1/);assert.match(aicc.resultText,/AICC finished/);
const noAck=dom.projectBridgeRuntime({previous:submitting,transition:'FAILED',sourceType:'CLIPBOARD_DIRECT',error:'AICC_DURABLE_ACK_MISSING'});assert.equal(noAck.status,'FAILED');assert.equal(noAck.taskId,null);
assert.equal(dom.recoverBridgeRuntimeProjection(submitting).status,'IDLE','reload clears transient local submission without durable identity');
assert.equal(dom.hasExecutionIdentity({executionId:'execution-1',runId:'run-1'}),true);
const runCreated=dom.projectBridgeRuntime({previous:{...submitting,status:'RUN_CREATED',taskId:'task-created',executionId:'execution-created',runId:'run-created'},correlation:{inboxId:'inbox-created',taskId:'task-created',runId:'run-created',sourceType:'GPT_BLOCK'},updatedAt:'2026-08-15T00:00:03.000Z'});
assert.equal(runCreated.status,'RUN_CREATED','result polling does not downgrade an acknowledged run');
const stalled=dom.projectBridgeRuntime({previous:submitting,transition:'SUBMISSION_STALLED',correlation:{submissionId:'submission-stalled',instructionId:'instruction-stalled',sourceType:'GPT_BLOCK'},error:'ACK_NOT_YET_CONFIRMED'});
assert.equal(dom.recoverBridgeRuntimeProjection(stalled).status,'SUBMISSION_STALLED','reload preserves a durable pending identity for reconciliation');
const lateRunning=dom.projectBridgeRuntime({previous:stalled,correlation:{submissionId:'submission-stalled',inboxId:'inbox-stalled',taskId:'task-stalled',executionId:'run-stalled',runId:'run-stalled',sourceType:'GPT_BLOCK'},item:{id:'inbox-stalled',submissionId:'submission-stalled',taskId:'task-stalled',instruction:{instructionId:'instruction-stalled'},executionId:'run-stalled',runId:'run-stalled',runtimeState:'RUNNING'}});
assert.equal(lateRunning.status,'RUNNING','canonical running truth supersedes a stalled acknowledgement projection');
const lateCompleted=dom.projectBridgeRuntime({previous:stalled,correlation:{submissionId:'submission-stalled',inboxId:'inbox-stalled',runId:'run-stalled',sourceType:'GPT_BLOCK'},item:{...completedItem,inboxId:'inbox-stalled',runId:'run-stalled',executionId:'run-stalled',report:{...completedItem.report,runId:'run-stalled',executionId:'run-stalled'}}});
assert.equal(lateCompleted.status,'COMPLETED','canonical terminal truth supersedes a stalled acknowledgement projection');

assert.match(content,/\.aicc-result-preview\{[^}]*max-height:100px[^}]*overflow-x:auto;overflow-y:auto/,'long canonical result lines remain internally inspectable without widening the panel');
assert.match(content,/data-aicc-result-expanded="true"[^}]*max-height:280px/,'expanded result remains bounded and scrollable');
assert.equal((runtimeTemplate.match(/data-aicc-runtime-source/g)??[]).length,1,'canonical execution source has one status-row projection');
assert.match(content,/function togglePanelResult\(\)[\s\S]*resultExpanded = !resultExpanded/);
assert.match(content,/async function copyPanelResult\(\)[\s\S]*navigator\.clipboard\.writeText\(result\.text\)/,'copy uses the full stored projection text');
assert.match(content,/async function insertPanelResult\(\)[\s\S]*insertReport\(\)[\s\S]*deliverCanonicalResult\(\)/,'panel delegates to existing AICC and Codex result actions');
assert.equal((content.match(/await copyAndInsertResult\(/g)??[]).length,2,'Codex and AICC retain one shared reliability pipeline');
assert.match(content,/async function deliverCanonicalResult\(\)[\s\S]*const ownerRequested = codexResultInFlight \|\| panelResultInFlight/,'top and panel Codex actions share canonical delivery');
assert.doesNotMatch(content.match(/async function insertPanelResult[\s\S]*?(?=\n  function togglePanelResult)/)?.[0]??'',/ownerConfirmSend|KeyboardEvent|requestSubmit|\.click\(/,'panel insertion never submits GPT');
assert.match(registry,/actionKey: 'next-step'[\s\S]*displayOrdinal: 5[\s\S]*执行下一步/,'execute-next-step remains an explicit Owner-facing action at ordinal five');
assert.match(content,/RUNTIME_PROJECTION_KEY = 'aicc-bridge-runtime-projection-v1'/);assert.match(content,/restoreRuntimeProjection\(\(\) => \{ void refreshAutoLoopStatus\(\); void pollResult\(\); \}\)/,'refresh restores before durable reconciliation');
assert.match(content,/runtimeAttemptUnbound = true[\s\S]*if \(runtimeAttemptUnbound\) return result/,'stale polling cannot bind an older result while a new submission is unbound');
assert.match(content,/PENDING_SUBMISSION_KEY = 'aicc-gpt-bridge-pending-submission-v1'/);
assert.match(content,/await persistStorage\(PENDING_SUBMISSION_KEY, pending\)[\s\S]*boundedMessage\(operation/,'pending identity is durable before transport begins');
assert.match(content,/SUBMISSION_UNCONFIRMED[\s\S]*reconcilePendingSubmission\(unconfirmed\)/,'watchdog warns and reconciles without automatic resubmission');
assert.equal((content.match(/section\.dataset\.aiccRuntimeResultPanel = 'true'/g)??[]).length,1,'one Runtime Result Panel is created');
assert.match(content,/const existing = document\.querySelector\(SELECTORS\.mount\)[\s\S]*if \(existing\) \{ panel = existing;[\s\S]*ensureRuntimeResultPanel\(\)/,'remount reconciliation preserves singleton ownership');
assert.match(content,/const AICC_DECISION_AUTHORITY = 0/);

console.log('M8.2.1.8 Bridge runtime result panel compact UX matrix passed');
