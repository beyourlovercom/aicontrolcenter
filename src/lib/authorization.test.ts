import { readFileSync } from 'node:fs';
const service = readFileSync(new URL('./controlService.ts', import.meta.url), 'utf8');
const app = readFileSync(new URL('../App.svelte', import.meta.url), 'utf8');
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
assert(service.includes('reauthorizeAuthorization'), 'same-context reauthorization exists');
assert(service.includes('status: \'SUPERSEDED\''), 'old authorization is superseded');
assert(service.includes('headShaAtAuthorization === repo.head'), 'current HEAD binding');
assert(service.includes('existing.repositoryRoot !== repo.repository') && service.includes('existing.workPackageId !== id') && service.includes('existing.branch !== repo.branch') && service.includes('existing.authoritySha !== repo.remoteMain'), 'real conflicts remain protected');
assert(app.includes('授权 HEAD') && app.includes('当前 HEAD'), 'authorization head evidence visible');
assert(app.includes('AUTHORIZATION_REAUTHORIZED'), 'reauthorization feedback visible');
console.log('authorization supersession contract tests passed');
