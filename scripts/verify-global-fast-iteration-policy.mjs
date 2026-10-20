import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const policy = readFileSync(new URL('../docs/00_Governance/AICC-GLOBAL-FAST-ITERATION-V1.md', import.meta.url), 'utf8');
const agents = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8');

const must = (text, token, description) => assert.ok(text.includes(token), description + ': ' + token);
for (const [token, description] of [
  ['Policy-ID: `AICC-GLOBAL-FAST-ITERATION-V1`', 'policy ID'],
  ['Policy-Version: `1`', 'schema version'],
  ['Status: `ACTIVE`', 'canonical activation marker'],
  ['Effective-After: `OWNER_APPROVED_MERGE`', 'main-merge gate'],
  ['## GPT Context Instruction', 'runtime propagation contract'],
  ['FAST_ITERATION_ELIGIBLE', 'explicit low-risk classification'],
  ['STANDARD_GATED_FLOW', 'non-fast fallback'],
  ['STOP_OWNER_GATE', 'high-risk stop gate'],
  ['Global UI Preview First', 'visual gate precedence'],
  ['real order/payment/customer/financial writes', 'production data safety'],
  ['3–5 minutes', 'speed is a target not an SLA'],
  ['MINOR_TWEAK', 'minor revision loop'],
  ['FAIL_FIXABLE', 'fix-and-retest loop'],
  ['NOT_VIABLE', 'abandon unworkable implementation'],
  ['OWNER_PASS', 'explicit human UAT'],
  ['exact-head', 'merge gate remains independent'],
  ['GitHub `main` SHA', 'cross-project authority provenance'],
  ['does not authorize execution', 'advisory-only semantics']
]) must(policy, token, description);

for (const token of [
  'AICC_GLOBAL_FAST_ITERATION_V1 = REQUIRED',
  'AICC-GLOBAL-FAST-ITERATION-V1.md',
  'Global UI Preview First',
  'Owner-approved merge',
  'Dev Owner PASS does not itself permit main merge'
]) must(agents, token, 'agent index');

const instruction = policy.split(/^## GPT Context Instruction\s*$/m)[1]?.split(/^## /m)[0]?.trim();
assert.ok(instruction && instruction.length < 4000, 'bounded single GPT Context instruction');
for (const term of ['GPT', 'Owner Dev UAT', 'CI', 'Owner exact-head merge', 'WWW/Production', 'Global UI Preview First']) {
  must(instruction, term, 'bounded instruction safety');
}
assert.ok(policy.indexOf('## Classification and precedence') < policy.indexOf('## Fast-loop SOP'), 'risk classification precedes workflow');
assert.ok(policy.indexOf('## Dev safety and functional evidence') < policy.indexOf('## GPT Context Instruction'), 'safety before context instruction');
console.log('PASS Global Fast Iteration V1 canonical governance contract');
