import { resolveProviderDecision } from './providerPresentation.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(resolveProviderDecision(null) === null, 'null decision stays unrouted');
assert(resolveProviderDecision({ foo: 'bar' }) === null, 'missing provider stays unrouted');
assert(resolveProviderDecision({ provider: 'OPENAI' }) === null, 'unknown provider fails closed');
assert(resolveProviderDecision({ provider: 42 }) === null, 'non-string provider fails closed');

const claude = resolveProviderDecision({ provider: 'CLAUDE_CODE' });
assert(claude?.provider === 'CLAUDE_CODE' && claude.displayLabel === 'Claude Code', 'CLAUDE_CODE maps to Claude Code');
assert(claude.routingReason === null, 'missing routing reason remains null');

const codex = resolveProviderDecision({ provider: 'CODEX' });
assert(codex?.provider === 'CODEX' && codex.displayLabel === 'Codex', 'CODEX maps to Codex');

const reason = resolveProviderDecision({ provider: 'CLAUDE_CODE', providerRoutingReason: '  implementation task  ' });
assert(reason?.routingReason === 'implementation task', 'routing reason is trimmed');
assert(resolveProviderDecision({ provider: 'CODEX', providerRoutingReason: '   ' })?.routingReason === null, 'blank routing reason stays absent');
assert(resolveProviderDecision({ provider: 'CODEX', providerRoutingReason: 123 })?.routingReason === null, 'non-string routing reason stays absent');
assert(resolveProviderDecision({ executorReady: true, codexReady: true }) === null, 'readiness never infers provider');

console.log('providerPresentation.test.ts PASS');
