import {strict as assert} from 'node:assert';import {assessWpRisk,riskIntelligenceGovernance} from './wpRiskIntelligence.ts';
assert.ok(assessWpRisk('update documentation').risk_score<40);
assert.equal(assessWpRisk('implement a feature module').risk_level,'MEDIUM');
const high=assessWpRisk('M8 Multi Repository Workspace architecture platform');assert.equal(high.risk_level,'HIGH');assert.equal(high.risk_score,160);assert.deepEqual(high.risk_factors,['MULTI_REPOSITORY','ARCHITECTURE_CHANGE','PLATFORM_CHANGE']);
assert.equal(assessWpRisk('change approval policy').risk_level,'HIGH');assert.equal(riskIntelligenceGovernance().canApprove,false);assert.equal(riskIntelligenceGovernance().canExecute,false);console.log('WP risk score engine matrix passed');
