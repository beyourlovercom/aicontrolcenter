import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const contract=readFileSync(new URL('../docs/00_Governance/AI-EXECUTOR-GOVERNANCE-V2.md',import.meta.url),'utf8');
const agents=readFileSync(new URL('../AGENTS.md',import.meta.url),'utf8');
for(const token of [
  'AI Executor Governance V2 — Global Canonical',
  '`CLAUDE_CODE_US`',
  '`CODEX_GOVERNED`',
  'Project-local rules may add stricter constraints but must not weaken or bypass this contract.',
  'Unknown quota values remain unknown.'
]) assert.match(contract,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.match(agents,/AI_EXECUTOR_GOVERNANCE_V2 = REQUIRED/);
assert.match(agents,/Governed US Claude is the default provider for tracked implementation/);
assert.match(agents,/Historical or subsystem-specific `Codex-only` runtime contracts remain scoped/);
console.log('AI Executor Governance V2 contract PASS');
