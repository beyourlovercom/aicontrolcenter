import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../App.svelte', import.meta.url), 'utf8');
const island = readFileSync(new URL('../components/GlobalFeedbackIsland.svelte', import.meta.url), 'utf8');
const actions = readFileSync(new URL('../components/entity/OwnerActionZone.svelte', import.meta.url), 'utf8');
const eligibility = readFileSync(new URL('./context/actionEligibility.ts', import.meta.url), 'utf8');
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
for (const state of ['IDLE', 'INFO', 'RUNNING', 'SUCCESS', 'BLOCKED', 'ERROR']) assert(source.includes(state), `feedback state: ${state}`);
assert(actions.includes('当前操作') && actions.includes('启动执行'), 'contextual current action is visible');
for (const label of ['刷新状态', '同步本地 main']) assert(!actions.includes(label), `diagnostic/repository action remains in primary zone: ${label}`);
assert(eligibility.includes('NO_RETRYABLE_RUNTIME') && source.includes('setFeedback'), 'blocked actions are visible');
assert(!source.includes('[object Object]'), 'structured errors never render object text');
assert(source.includes('<GlobalFeedbackIsland {feedback} onCopy={copyGlobalFeedback}/>'), 'one root-level feedback renderer');
assert(!source.includes('owner-action-feedback'), 'WP has no local feedback renderer');
assert(!source.includes('pr-action-feedback'), 'PR has no local feedback renderer');
assert(!source.includes('runtime-action-feedback'), 'Runtime has no local feedback renderer');
assert(island.includes('data-testid="global-feedback-island"'), 'global feedback DOM marker');
assert(island.includes('data-feedback-state={feedback.state.toLowerCase()}'), 'global feedback state marker');
assert(!source.includes('操作结果将在此显示'), 'legacy idle feedback card is removed');
console.log('action feedback contract tests passed');
