import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const terminal=readFileSync(new URL('../components/CodexCliLive.svelte',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../components/entity/RuntimeWorkspace.svelte',import.meta.url),'utf8');
const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const loop=readFileSync(new URL('./gptAutoControlLoop.ts',import.meta.url),'utf8');
const runtime=readFileSync(new URL('./runtimeManager.ts',import.meta.url),'utf8');
const bridge=readFileSync(new URL('./bridgeCore.ts',import.meta.url),'utf8');
const vite=readFileSync(new URL('../../vite.config.ts',import.meta.url),'utf8');

assert.match(terminal,/data-testid="codex-cli-continue"/,'CONTINUE_BUTTON_PRESENT');
assert.match(terminal,/data-testid="codex-cli-continue"/,'CONTINUE_ALWAYS_VISIBLE');
assert.match(terminal,/data-testid="codex-cli-stop"/,'STOP_ALWAYS_VISIBLE');
assert.match(terminal,/resumeEnabled[\s\S]*resumeReason/,'CONTINUE_TECHNICAL_STATE_GATE');
assert.match(terminal,/stopEnabled[\s\S]*stopReason/,'STOP_TECHNICAL_STATE_GATE');
assert.match(terminal,/onResume\(runId\)/,'CONTINUE_EXACT_RUN');
assert.match(terminal,/data-testid="codex-cli-continue"[\s\S]*data-testid="codex-cli-stop"/,'CONTINUE_BEFORE_STOP');
assert.match(workspace,/aicc-resume-exact-runtime/,'CONTINUE_SHARED_HANDLER');
assert.match(app,/setContext\('aicc-resume-exact-runtime',resumeExactRuntime\)/,'CONTINUE_APP_HANDLER_WIRING');
assert.match(loop,/status !== 'STOPPED_BY_OWNER'/,'CONTINUE_OWNER_STOP_GATE');
assert.match(loop,/loop\.run_id !== input\.run_id/,'CONTINUE_EXACT_LOOP_RUN_GATE');
assert.match(loop,/item\.runId === input\.run_id/,'CONTINUE_NEW_RUN_GATE');
assert.match(loop,/persisted\.binding_epoch/,'CONTINUE_BINDING_EPOCH_PRESERVED');
assert.match(loop,/input\.instruction_text/,'INTERRUPTED_INSTRUCTION_REUSED');
assert.doesNotMatch(loop,/SIGCONT/,'NO_SIGCONT_RESUME');
assert.match(runtime,/controlLoopId: options\.controlLoopId/,'RUNTIME_PERSISTS_CONTROL_LOOP_ID');
assert.match(bridge,/controlLoopId:instruction\.originContext\?\.controlLoopId/,'SUBMISSION_PASSES_CONTROL_LOOP_ID');
assert.match(vite,/server\.middlewares\.use\('\/api\/codex\/resume'/,'RESUME_ENDPOINT');
assert.match(vite,/current\.phase!== 'STOPPED'|current\.phase!=='STOPPED'/,'RESUME_RUNTIME_PHASE_GATE');
assert.match(vite,/resumeControlLoopByOwner/,'RESUME_CANONICAL_LOOP_HANDLER');
assert.match(vite,/!current\.controlLoopId\)\{const resumed=resumeStoppedExecution/,'ORDINARY_RUN_RESUME_PATH');
assert.match(vite,/newRunId:resumed\.item\.runId/,'RESUME_RETURNS_NEW_RUN_ID');
assert.match(app,/正在继续自动循环/,'RESUMING_FEEDBACK');
assert.match(app,/已继续执行/,'RESUMED_FEEDBACK');
assert.match(app,/继续执行失败/,'RESUME_FAILURE_FEEDBACK');

console.log('runtime Owner Continue contract passed');
