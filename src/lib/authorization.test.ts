import { readFileSync } from 'node:fs';
const service = readFileSync(new URL('./controlService.ts', import.meta.url), 'utf8');
const app = readFileSync(new URL('../App.svelte', import.meta.url), 'utf8');
const evidence = readFileSync(new URL('../components/entity/EntityEvidencePanel.svelte', import.meta.url), 'utf8');
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
assert(service.includes('reauthorizeAuthorization'), 'same-context reauthorization exists');
assert(service.includes('status: \'SUPERSEDED\''), 'old authorization is superseded');
assert(service.includes('headShaAtAuthorization === repo.head'), 'current HEAD binding');
assert(service.includes("'codex_runtime','writer_lock'")&&!service.includes("forbidden: ['codex_runtime'"),'authorization explicitly binds canonical runtime and writer lock');
assert(service.includes('authorizationSupersessionBlocker') && service.includes('ACTIVE_RUNTIME_CONFLICT') && service.includes('WRITER_LOCK_HELD'), 'supersession safety gates remain protected');
assert(evidence.includes('Authorized HEAD') && evidence.includes('Current HEAD'), 'authorization head evidence visible');
assert(app.includes('AUTHORIZATION_SUCCESS'), 'authorization feedback visible');
console.log('authorization supersession contract tests passed');
