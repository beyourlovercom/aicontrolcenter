import { readExecutorFacts, roomRuntimeBinding } from './executorFacts.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const payloads: Record<string, { status: number; body: unknown }> = {
  '/api/project': { status: 200, body: { available: true, context: { project: { id: 'aicc', name: 'AICC' }, repository: { identity: 'o/r', path: '/wt', branch: 'feat/v5.3', head: 'a'.repeat(40), dirty: false } } } },
  '/api/executor': { status: 200, body: { available: true, executor: { readiness: { ready: true, version: '1.0' }, activeLease: null, latestRun: null } } },
  '/api/pr-delivery': { status: 503, body: { ok: false, errorCode: 'CI_FACTS_UNAVAILABLE' } },
  '/api/work': { status: 200, body: { available: true, store: { workPackages: [], tasks: [] } } }
};

const fetcher = (async (input: RequestInfo | URL) => {
  const key = String(input);
  const value = payloads[key];
  if (!value) throw new Error(`unexpected endpoint ${key}`);
  return new Response(JSON.stringify(value.body), { status: value.status, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

const facts = await readExecutorFacts(fetcher);
assert(facts.project.available && facts.project.value?.repository.branch === 'feat/v5.3', 'project facts remain real and available');
assert(facts.executor.available && facts.executor.value?.readiness.ready === true, 'executor facts remain available');
assert(!facts.prDelivery.available && facts.prDelivery.errorCode === 'CI_FACTS_UNAVAILABLE', 'PR/CI failure is isolated instead of fabricating facts');
assert(facts.work.available, 'work facts remain available when PR facts fail');

assert(roomRuntimeBinding('feat/v5.3', '/wt', facts) === 'MATCH', 'exact runtime binding reports MATCH');
assert(roomRuntimeBinding('feature/other', '/worktrees/other', facts) === 'DRIFT', 'declared room binding drift is explicit');
assert(roomRuntimeBinding('feat/v5.3', '/wt', null) === 'UNAVAILABLE', 'missing facts never fabricate a match');

console.log('executorFacts.test.ts PASS');
