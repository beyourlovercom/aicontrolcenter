import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {parseExecutionV1} from './bridgeCore.ts';

const root=process.cwd();
const content=readFileSync(join(root,'web-adapter/chrome-extension-current/content.js'),'utf8');
const registry=readFileSync(join(root,'web-adapter/chrome-extension-current/bridge-action-registry.js'),'utf8');
const worker=readFileSync(join(root,'web-adapter/chrome-extension-current/service-worker.js'),'utf8');
const core=readFileSync(join(root,'src/lib/bridgeCore.ts'),'utf8');
const vite=readFileSync(join(root,'vite.config.ts'),'utf8');

const labels=['剪贴板发送到 Codex 执行','发送到 Codex 并执行','插入 Codex 结果','发送到 AICC','执行下一步'];
let priorIndex=-1;
for(const label of labels){const index=registry.indexOf(label);assert.ok(index>priorIndex,`${label} renders in canonical order`);priorIndex=index;}
assert.equal((content.match(/data-aicc-action-key="clipboard-codex-execute"/g)??[]).length,1,'clipboard action renders once with a stable key');

const clipboardAction=content.match(/async function executeClipboardWithCodex\(\)[\s\S]*?(?=\n  function mountNativeActions)/)?.[0]??'';
assert.match(clipboardAction,/if \(clipboardExecutionInFlight\) return/,'duplicate clicks are ignored');
assert.match(clipboardAction,/await readInboundClipboard\(\)/,'clipboard is read after the explicit action starts');
assert.doesNotMatch(clipboardAction,/isSupportedClipboardInstruction|AICC_EXECUTION_V1/,'clipboard action does not classify content');
assert.match(clipboardAction,/sendTask\(binding\.text, binding\.originContext, 'CLIPBOARD_DIRECT', 'IMPORT_AND_RUN'/,'clipboard execution reuses IMPORT_AND_RUN');
assert.match(clipboardAction,/sourceType: 'CLIPBOARD_DIRECT', ownerDirectExecution: true/,'explicit owner source metadata is created');
assert.doesNotMatch(content,/setInterval\([^)]*(?:readInboundClipboard|executeClipboardWithCodex)|MutationObserver\([^)]*(?:readInboundClipboard|executeClipboardWithCodex)/,'background activity cannot read or execute clipboard content');

assert.match(content,/CLIPBOARD_TEXT_REQUIRED/,'empty clipboard text is rejected');
assert.doesNotMatch(content,/isSupportedClipboardInstruction/,'no clipboard executability precheck remains');
assert.match(worker,/const sourceType = \['GPT_BLOCK', 'CLIPBOARD_DIRECT'\]\.includes\(message\.sourceType\)/,'worker forwards only supported execution sources');
assert.match(worker,/JSON\.stringify\(\{ payload: text, sourceType, sourceReference:/,'clipboard payload uses the existing Inbox API');
assert.match(worker,/model: message\.codexProfile\?\.model, reasoning: message\.codexProfile\?\.reasoning_effort/,'clipboard execution forwards selected model and reasoning');
assert.equal((worker.match(/api\/gpt-bridge\/launch/g)??[]).length,0,'Bridge does not decide whether to launch a receipt');
assert.match(vite,/sourceType\?:'CLIPBOARD'\|'WEB_BRIDGE'\|'GPT_BLOCK'\|'CLIPBOARD_DIRECT'/,'HTTP ingress accepts clipboard source metadata');

const instructionText='AICC_EXECUTION_V1\nENTITY_TYPE: WORK_PACKAGE\nENTITY_ID: AICC-M8.2.1.3\nEXECUTION_TYPE: IMPLEMENTATION\nREPOSITORY: /tmp/example\nBRANCH: test\nEXPECTED_HEAD: abc\nSANDBOX: workspace-write\nREQUIRES_AUTHORIZATION: false\nINSTRUCTION_BEGIN\nRun clipboard test.\nINSTRUCTION_END';
const first=parseExecutionV1(instructionText,'CLIPBOARD_DIRECT','https://chatgpt.com/c/test');
const second=parseExecutionV1(instructionText,'CLIPBOARD_DIRECT','https://chatgpt.com/c/test');
assert.equal(first.sourceType,'CLIPBOARD_DIRECT');
assert.equal(first.ownerDirectExecution,true,'OWNER_DIRECT_EXECUTION is persisted from the trusted source type');
assert.ok(first.receivedAt,'source timestamp is persisted');
assert.equal(first.instructionId,second.instructionId,'parsing preserves the instruction identifier without Bridge-side deduplication');
assert.match(core,/ownerDirectExecution:deliveryProfile\?true:instruction\.ownerDirectExecution/,'explicit source metadata is forwarded unchanged');
assert.match(core,/submissionId:normalizedSubmissionId/,'submission identity is persisted for transport idempotency');

const workerCorrelation=worker.match(/const correlation = \{[^\n]+sourceType[^\n]+\};/)?.[0]??'';
assert.match(workerCorrelation,/inboxId: item\.id/);
assert.match(workerCorrelation,/sourceType, ownerDirectExecution/,'source and owner boundary are recorded in correlation');
assert.doesNotMatch(worker,/received\.item\.state !== 'READY'/,'Bridge does not judge receipt state before forwarding');
assert.doesNotMatch(content,/Codex 执行中 · 来源:|Codex 结果已就绪 · 来源:/,'legacy runtime status is not duplicated above the runtime panel');
assert.match(content,/sourceDisplayLabel\(source\) \{ return source === 'CLIPBOARD_DIRECT' \? '剪贴板' : source \|\| ''; \}/,'clipboard source keeps its canonical value and receives a compact display label');
assert.match(content,/\[SELECTORS\.runtimeSource, idle \? '' : sourceDisplayLabel\(runtimeProjection\.source\)\]/,'source information remains projected by the runtime panel');
assert.match(content,/insertCodexResult[\s\S]*pollResult\(false\)[\s\S]*deliverCanonicalResult\(\)/,'clipboard results reuse Codex result insertion');
assert.match(content,/deliverCanonicalResult[\s\S]*copyAndInsertResult\(envelope/,'result insertion continues through the unified reliability pipeline');
assert.match(content,/const AICC_DECISION_AUTHORITY = 0/);

console.log('M8.2.1.3 bridge clipboard Codex execution matrix passed');
