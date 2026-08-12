import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const detail=readFileSync(new URL('../components/entity/WorkPackageDetail.svelte',import.meta.url),'utf8');

assert.match(app,/activeTab==='概览'[\s\S]*data-testid="wp-overview-content"/);
assert.match(app,/activeTab==='流程'[\s\S]*data-testid="wp-workflow-content"/);
assert.match(app,/activeTab==='工作包'[\s\S]*<WorkPackageDetail context=\{context\}/);
assert.match(app,/activeTab==='运行'[\s\S]*<RuntimeWorkspace/);
assert.match(app,/activeTab==='验证'[\s\S]*data-testid="wp-validation-content"/);
assert.match(app,/activeTab==='UAT'[\s\S]*<HumanUatWorkspace/);
assert.match(app,/activeTab==='证据'[\s\S]*data-testid="wp-evidence-content"/);
assert.match(app,/data-testid="wp-tab-error"/);
assert.match(detail,/data-testid="wp-work-package-content"/);
assert(!app.includes("activeTab==='流程'}<section class=\"overview\""),'workflow does not fall through to overview');
assert(!app.includes("activeTab==='工作包'}<section class=\"overview\""),'work-package does not fall through to overview');
console.log('WP tab content mapping tests passed');
