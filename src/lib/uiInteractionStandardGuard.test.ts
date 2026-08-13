import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const standard=readFileSync(new URL('../../docs/00_Governance/AICC-V2-UI-INTERACTION-STANDARD-001.md',import.meta.url),'utf8');
const registry=readFileSync(new URL('../../docs/00_Governance/AICC-V2-BASELINE-REGISTRY.md',import.meta.url),'utf8');
const wpActions=readFileSync(new URL('../components/entity/OwnerActionZone.svelte',import.meta.url),'utf8');
const prActions=readFileSync(new URL('../components/entity/PrOwnerActionZone.svelte',import.meta.url),'utf8');
const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const header=readFileSync(new URL('../components/entity/EntityHeader.svelte',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../components/WorkflowTimeline.svelte',import.meta.url),'utf8');
const roadmap=readFileSync(new URL('../components/RoadmapTree.svelte',import.meta.url),'utf8');

assert.match(standard,/Version: `1\.2`/);
assert.match(standard,/Owner Action Zone is contextual, not a command toolbar/i);
assert.match(standard,/PRIMARY OWNER ACTION <= 1/);
assert.match(standard,/当前操作区/);
assert.match(standard,/刷新、local-main sync|Refresh, local-main sync/);
assert.match(standard,/Authorization appears only when/);
assert.match(standard,/Stop appears only while/);
assert.match(standard,/Retry appears[\s\S]*only after/);
assert.match(standard,/action surface consumes canonical state and remains a projection/i);
assert.match(standard,/Owner blocked status single source/i);
assert.match(registry,/AICC-V2-UI-INTERACTION-STANDARD-001 \| 1\.2 \| APPROVED_BASELINE/);
assert.match(wpActions,/context\.availableActions/);
assert.match(prActions,/context\.availableActions/);
assert.match(app,/resolveOwnerStatusProjection\(context,bridgeOutbox\)/);
assert.match(app,/resolveOwnerWorkflowStages\(context,bridgeOutbox\)/);
assert.match(app,/projectOwnerRoadmapNodes\(snapshot\.roadmap\.value\?\?\[\],selectedEntity,ownerStatus\)/);
assert.match(header,/statusOverride/);
assert.match(workflow,/getStatusPresentationMeta\(stage\.status\)/);
assert.match(roadmap,/StatusDot status=\{node\.status\}/);
for(const source of [app,header,workflow,roadmap,wpActions,prActions]){
  assert.equal(/context\.status\s*===\s*['"]BLOCKED['"]/.test(source),false,'direct Owner blocked derivation');
  assert.equal(/lifecycle\.(?:effectiveStatus|status)\s*===\s*['"]BLOCKED['"]/.test(source),false,'direct lifecycle blocked derivation');
}
assert.equal((standard.match(/OwnerStatusProjection/g)??[]).length>=3,true);
assert.equal((standard.match(/PRIMARY OWNER ACTION <= 1/g)??[]).length>=1,true);
console.log('UI interaction contextual action guard passed');
