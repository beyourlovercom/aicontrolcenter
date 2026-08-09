import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../App.svelte', import.meta.url), 'utf8');
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
for (const state of ['IDLE', 'RUNNING', 'SUCCESS', 'BLOCKED', 'ERROR']) assert(source.includes(state), `feedback state: ${state}`);
for (const label of ['刷新状态', '确认授权', '启动 Codex', '停止', '重试', '同步本地 main']) assert(source.includes(label), `action feedback: ${label}`);
assert(source.includes('NOT_IMPLEMENTED') && source.includes('setFeedback'), 'blocked actions are visible');
assert(!source.includes('[object Object]'), 'structured errors never render object text');
assert(source.includes('data-testid="owner-action-feedback"'), 'feedback DOM marker');
assert(source.includes('data-feedback-state={feedback.state.toLowerCase()}'), 'feedback state marker');
assert(source.indexOf('data-testid="owner-action-feedback"') > source.indexOf('Owner Action Zone'), 'feedback after action zone');
assert(source.indexOf('data-testid="owner-action-feedback"') < source.indexOf('Work Package detail'), 'feedback before work package detail');
assert(source.includes('请选择一个 Owner Action'), 'idle feedback is visible');
console.log('action feedback contract tests passed');
