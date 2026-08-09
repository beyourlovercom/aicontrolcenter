import { readRepository, validWorkPackageId } from './controlService.ts';
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
assert(validWorkPackageId('AICC-CODEX-ONLY-MIGRATION-001'), 'valid WP selection');
assert(!validWorkPackageId('../secret') && !validWorkPackageId('/tmp/x') && !validWorkPackageId('AICC-X/../Y'), 'path traversal WP rejected');
const repo = readRepository();
assert(repo.branch === 'rebuild/aicc-v2', 'branch read');
assert(repo.head.length >= 40, 'HEAD read');
assert(repo.worktree === 'CLEAN' || repo.worktree === 'DIRTY', 'worktree read');
assert(!('runtime' in repo) && !('authorization' in repo), 'no fake runtime');
console.log('local control service contract tests passed');
