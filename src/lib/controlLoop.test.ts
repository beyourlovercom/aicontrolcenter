import { authorityStatus, hasRuntimeStartAction, resolverDecision, syncAllowed } from './controlLoop.ts';

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

assert(authorityStatus('VERIFIED') === 'VERIFIED', 'verified status maps to verified');
assert(authorityStatus('DRIFT') === 'DRIFT', 'drift status maps to drift');
assert(authorityStatus('REMOTE_UNAVAILABLE') === 'UNAVAILABLE', 'unknown authority fails closed');
assert(syncAllowed({ allowed: true, blockers: [], plannedActions: [] }), 'allowed evaluation enables sync');
assert(!syncAllowed({ allowed: false, blockers: ['WORKTREE_DIRTY'], plannedActions: [] }), 'blocker disables sync');
assert(resolverDecision({ decision: 'START_ALLOWED', workPackage: null, blockers: [] }) === 'START_ALLOWED', 'resolver decision is displayed');
assert(resolverDecision(null) === 'UNKNOWN', 'missing resolver is unknown');
assert(hasRuntimeStartAction() === false, 'runtime start action is never exposed');

console.log('control loop frontend contract tests passed');
