import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const terminal=readFileSync(new URL('../components/CodexCliLive.svelte',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../components/entity/RuntimeWorkspace.svelte',import.meta.url),'utf8');
const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const manager=readFileSync(new URL('./runtimeManager.ts',import.meta.url),'utf8');
const controlLoop=readFileSync(new URL('./gptAutoControlLoop.ts',import.meta.url),'utf8');
const vite=readFileSync(new URL('../../vite.config.ts',import.meta.url),'utf8');

assert.match(terminal,/data-testid="codex-cli-stop"/,'STOP_BUTTON_PRESENT');
assert.match(terminal,/stop-action[^\n]*清屏/,'STOP_BUTTON_BEFORE_CLEAR');
assert.match(terminal,/onStop\(runId\)/,'EXACT_RUN_STOP');
assert.match(workspace,/getContext<.*aicc-stop-exact-runtime/,'STOP_HANDLER_AUTHORITY');
assert.doesNotMatch(workspace,/fetch\('\/api\/codex\/stop'/,'RUNTIME_WORKSPACE_LOCAL_STOP_AUTHORITY');
assert.match(app,/setContext\('aicc-stop-exact-runtime',stopExactRuntime\)/,'STOP_BUTTON_APP_HANDLER_WIRING');
assert.doesNotMatch(terminal,/latest|killall|pkill/,'STOP_LATEST_RUN_FALLBACK');
assert.match(manager,/process\.kill\(s\.pid, "SIGTERM"\)/,'SIGTERM_FIRST');
assert.match(manager,/stopRuntimeWithGrace[\s\S]*setTimeout[\s\S]*process\.kill\(stopped\.pid,'SIGKILL'\)/,'SIGKILL_ONLY_AFTER_GRACE');
assert.match(manager,/current\.runId!==runId\|\|current\.pid!==stopped\.pid/,'PID_REUSE_SAFETY');
assert.match(manager,/function reconcileOwnerStoppedProjection\([\s\S]*state\.phase='STOPPED'/,'OWNER_CANCEL_FINAL_STATE');
assert.match(controlLoop,/stopControlLoopByOwner/,'AUTO_LOOP_STOPPED_BY_OWNER');
assert.match(vite,/readRuntimeByRunIdReadOnly\(payload\.runId\)/,'STOP_LOOKUP_EXACT_RUN');
assert.match(vite,/stopControlLoopByOwner\(loop\.control_loop_id\)/,'AUTO_LOOP_CONTINUE_DISABLED');
assert.match(vite,/stopRuntimeWithGrace\(payload\.runId\)/,'STOP_EXACT_RUNTIME');

console.log('runtime exact-run Owner Stop contract passed');
