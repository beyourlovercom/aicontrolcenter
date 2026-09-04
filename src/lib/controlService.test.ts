import { readLocalServiceHealthStatusAsync, readRepositoryAsync, validWorkPackageId } from './controlService.ts';
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
assert(validWorkPackageId('AICC-CODEX-ONLY-MIGRATION-001'), 'valid WP selection');
assert(!validWorkPackageId('../secret') && !validWorkPackageId('/tmp/x') && !validWorkPackageId('AICC-X/../Y'), 'path traversal WP rejected');
const repo = await readRepositoryAsync();
assert(typeof repo.branch==='string'&&typeof repo.head==='string','repository facts have stable string shape');
assert(['CLEAN','DIRTY','UNAVAILABLE'].includes(repo.worktree),'worktree truth is explicit');
if(repo.branch==='unavailable')assert(repo.head==='unavailable'&&repo.worktree==='UNAVAILABLE','missing canonical local repository fails closed without fabricated Git facts');
else{assert(repo.head.length>=40,'available repository exposes an exact HEAD');assert(repo.worktree==='CLEAN'||repo.worktree==='DIRTY','available repository exposes real worktree state')}
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
