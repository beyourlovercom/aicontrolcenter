import { authorityStatus, cancelSync, hasRuntimeStartAction, requestSync, resolverDecision, syncAllowed, syncOutcome } from './controlLoop.ts';

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

assert(authorityStatus('VERIFIED') === 'VERIFIED', 'verified status maps to verified');
assert(authorityStatus('DRIFT') === 'DRIFT', 'drift status maps to drift');
assert(authorityStatus('REMOTE_UNAVAILABLE') === 'UNAVAILABLE', 'unknown authority fails closed');
assert(syncAllowed({ allowed: true, blockers: [], plannedActions: [] }), 'allowed evaluation enables sync');
assert(!syncAllowed({ allowed: false, blockers: ['WORKTREE_DIRTY'], plannedActions: [] }), 'blocker disables sync');
assert(resolverDecision({ decision: 'START_ALLOWED', workPackage: null, blockers: [] }) === 'START_ALLOWED', 'resolver decision is displayed');
assert(resolverDecision(null) === 'UNKNOWN', 'missing resolver is unknown');
assert(hasRuntimeStartAction() === false, 'runtime start action is never exposed');
assert(requestSync({ allowed: true, blockers: [], plannedActions: [] }).kind === 'confirming', 'allowed sync opens explicit confirmation');
assert(requestSync({ allowed: false, blockers: ['WORKTREE_DIRTY'], plannedActions: [] }).kind === 'idle', 'dirty sync cannot open confirmation');
assert(cancelSync().kind === 'cancelled', 'cancel reports visible cancellation');
assert(syncOutcome({ success: true, error: null }).kind === 'success', 'successful sync reports success');
assert(syncOutcome({ success: false, error: 'SYNC_BLOCKED' }).kind === 'failure', 'failed sync reports failure');

console.log('control loop frontend contract tests passed');
