import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const standard=readFileSync(new URL('../../docs/00_Governance/AICC-V2-UI-INTERACTION-STANDARD-001.md',import.meta.url),'utf8');
const registry=readFileSync(new URL('../../docs/00_Governance/AICC-V2-BASELINE-REGISTRY.md',import.meta.url),'utf8');
const wpActions=readFileSync(new URL('../components/entity/OwnerActionZone.svelte',import.meta.url),'utf8');
const prActions=readFileSync(new URL('../components/entity/PrOwnerActionZone.svelte',import.meta.url),'utf8');

assert.match(standard,/Version: `1\.1`/);
assert.match(standard,/Owner Action Zone is contextual, not a command toolbar/i);
assert.match(standard,/PRIMARY OWNER ACTION <= 1/);
assert.match(standard,/当前操作区/);
assert.match(standard,/刷新、local-main sync|Refresh, local-main sync/);
assert.match(standard,/Authorization appears only when/);
assert.match(standard,/Stop appears only while/);
assert.match(standard,/Retry appears[\s\S]*only after/);
assert.match(standard,/action surface consumes canonical state and remains a projection/i);
assert.match(registry,/AICC-V2-UI-INTERACTION-STANDARD-001 \| 1\.1 \| APPROVED_BASELINE/);
assert.match(wpActions,/context\.availableActions/);
assert.match(prActions,/context\.availableActions/);
assert.equal((standard.match(/PRIMARY OWNER ACTION <= 1/g)??[]).length>=1,true);
console.log('UI interaction contextual action guard passed');
