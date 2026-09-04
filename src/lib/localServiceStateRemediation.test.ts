import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
assert.match(app,/serviceState:'检查中'\|'正常'\|'降级'\|'已断开'\|'正在重连'\|'异常'=readLastServiceState\(\)/);
assert.match(app,/healthPollInFlight=false/);
assert.match(app,/if\(healthPollInFlight\)return/);
assert.match(app,/const generation=\+\+healthPollGeneration/);
assert.match(app,/generation!==healthPollGeneration/);
assert.match(app,/serviceState='已断开'/);
assert.match(app,/healthRecoveryInFlight=true;serviceState='正在重连'/);
assert.doesNotMatch(app,/healthFailures>=HEALTH_FAILURE_THRESHOLD\)\{serviceState='正在重连'/);
assert.doesNotMatch(app,/serviceState!='正常'\)\{serviceState='正在重连'/);
assert.match(app,/boundedRequest\('\/api\/roadmap'\)/,'Roadmap loading remains independent of serviceState');
console.log('local service state remediation tests passed');
