import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../App.svelte', import.meta.url), 'utf8');
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
for (const state of ['IDLE', 'RUNNING', 'SUCCESS', 'BLOCKED', 'ERROR']) assert(source.includes(state), `feedback state: ${state}`);
for (const label of ['刷新状态', '确认授权', '启动 Codex', '停止', '重试', '同步本地 main']) assert(source.includes(label), `action feedback: ${label}`);
assert(source.includes('NOT_IMPLEMENTED') && source.includes('setFeedback'), 'blocked actions are visible');
assert(!source.includes('[object Object]'), 'structured errors never render object text');
console.log('action feedback contract tests passed');
