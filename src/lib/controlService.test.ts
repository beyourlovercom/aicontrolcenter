import { readLocalServiceHealthStatusAsync, readRepositoryAsync, validWorkPackageId } from './controlService.ts';
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
assert(validWorkPackageId('AICC-CODEX-ONLY-MIGRATION-001'), 'valid WP selection');
assert(!validWorkPackageId('../secret') && !validWorkPackageId('/tmp/x') && !validWorkPackageId('AICC-X/../Y'), 'path traversal WP rejected');
const repo = await readRepositoryAsync();
assert(repo.branch === 'rebuild/aicc-v2', 'branch read');
assert(repo.head.length >= 40, 'HEAD read');
assert(repo.worktree === 'CLEAN' || repo.worktree === 'DIRTY', 'worktree read');
assert(!('runtime' in repo) && !('authorization' in repo), 'no fake runtime');
let eventLoopTicked=false;
const tick=new Promise<void>(resolve=>setImmediate(()=>{eventLoopTicked=true;resolve();}));
const started=Date.now();
const degraded=await readLocalServiceHealthStatusAsync({diagnosticTimeoutMs:25,detectPortOwner:()=>new Promise(resolve=>setTimeout(()=>resolve({portOwner:'CANONICAL_AICC_SERVICE' as const}),250))});
await tick;
assert(Date.now()-started<150,'slow diagnostic has a bounded health deadline');
assert(eventLoopTicked,'slow diagnostic does not block the event loop');
assert(degraded.portOwner==='UNAVAILABLE'&&degraded.serviceHealthy===false,'timed out diagnostics return truthful unavailable health evidence');
console.log('local control service contract tests passed');
