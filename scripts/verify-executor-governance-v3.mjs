import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const text=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const v3=text('docs/00_Governance/AI-EXECUTOR-GOVERNANCE-V3.md');
const agents=text('AGENTS.md');
const route=text('v3/lib/provider-routing.mjs');
const bridge=text('v3/lib/bridge-runtime.mjs');
const runner=text('v3/lib/remote-runner-service.mjs');
const next=text('v3/lib/next-step-runtime.mjs');
for(const token of ['AICC Executor Governance V3','SELF_HOSTED_DC','Claude retired',
 'STOP_GATE: DC_AUTO_DISPATCH_NOT_AUTHORIZED','NOT ACTIVE ON GITHUB MAIN OR PRODUCTION'])
 assert(v3.includes(token),'Missing V3 governance token '+token);
assert(agents.includes('AICC-EXECUTOR-DC-PRIMARY-V3'));
assert(agents.includes('Not active in GitHub main or production'));
assert(route.includes("V3_EXECUTION_PROVIDERS=Object.freeze(['SELF_HOSTED_DC','CODEX'])"));
assert(bridge.includes('BRIDGE_DC_AUTO_DISPATCH_NOT_AUTHORIZED'));
assert(bridge.includes('BRIDGE_CLAUDE_RETIRED'));
assert(runner.includes('REMOTE_RUNNER_CLAUDE_RETIRED'));
assert(next.includes('SELF_HOSTED_DC|CODEX'));
console.log('AICC Executor Governance V3 DEV CANDIDATE contract PASS (NOT ACTIVE)');
