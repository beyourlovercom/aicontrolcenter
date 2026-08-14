import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');

assert.match(app,/activeTab==='运行'[\s\S]*<RuntimeWorkspace/);
assert.match(app,/activeTab==='UAT'[\s\S]*<HumanUatWorkspace/);
assert.match(app,/activeTab==='概览'[\s\S]*data-testid="wp-overview-content"/);
assert.match(app,/activeTab==='证据'[\s\S]*data-testid="wp-evidence-content"/);
assert.match(app,/activeTab==='授权'[\s\S]*<AuthorizationWorkspace/);
assert.match(app,/WORKSPACE_TABS=\['运行','UAT','概览','证据','授权'\]/);
assert.match(app,/data-testid="wp-tab-error"/);
for(const removed of ['提交','PRs','M5评审','活动','设置','计划'])assert(!app.includes(`activeTab==='${removed}'`),`${removed} is removed from primary WP navigation`);
console.log('WP tab content mapping tests passed');
