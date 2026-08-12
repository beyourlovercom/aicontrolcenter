import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../App.svelte', import.meta.url), 'utf8');
const actions = readFileSync(new URL('../components/entity/OwnerActionZone.svelte', import.meta.url), 'utf8');
const eligibility = readFileSync(new URL('./context/actionEligibility.ts', import.meta.url), 'utf8');
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
for (const state of ['IDLE', 'RUNNING', 'SUCCESS', 'BLOCKED', 'ERROR']) assert(source.includes(state), `feedback state: ${state}`);
assert(actions.includes('当前操作') && actions.includes('启动执行'), 'contextual current action is visible');
for (const label of ['刷新状态', '同步本地 main']) assert(!actions.includes(label), `diagnostic/repository action remains in primary zone: ${label}`);
assert(eligibility.includes('NO_RETRYABLE_RUNTIME') && source.includes('setFeedback'), 'blocked actions are visible');
assert(!source.includes('[object Object]'), 'structured errors never render object text');
assert(source.includes('data-testid="owner-action-feedback"'), 'feedback DOM marker');
assert(source.includes('data-feedback-state={feedback.state.toLowerCase()}'), 'feedback state marker');
assert(source.indexOf('data-testid="owner-action-feedback"') > source.indexOf('<OwnerActionZone'), 'feedback after action zone');
assert(source.includes('data-testid="wp-overview-content"'), 'feedback remains in overview content');
assert(source.includes('等待 Owner 操作'), 'idle feedback is visible');
console.log('action feedback contract tests passed');
