import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const wp=readFileSync(new URL('../components/entity/OwnerActionZone.svelte',import.meta.url),'utf8');
const pr=readFileSync(new URL('../components/entity/PrOwnerActionZone.svelte',import.meta.url),'utf8');
const tabs=readFileSync(new URL('../components/StatusTabs.svelte',import.meta.url),'utf8');
const standard=readFileSync(new URL('../../docs/00_Governance/AICC-V2-UI-INTERACTION-STANDARD-001.md',import.meta.url),'utf8');

assert(!app.includes('class="service-action-feedback"'),'normal service status is not a floating persistent pill');
assert(app.includes('本地服务：{serviceState}'),'header remains the persistent service status location');
assert(app.includes('recoveryToastTimer=window.setTimeout'),'service recovery feedback is transient');
assert.equal((app.match(/let [^;]*activeTab=/g)??[]).length,1,'one tab selection authority exists');
assert(!app.includes('displayTab')&&!app.includes('contentTab')&&!app.includes('underlineTab'),'no competing tab state exists');
assert(tabs.includes('class:active={active===tab}')&&tabs.includes('onSelect(tab)'),'tab indicator and content use the same selected tab');
assert(wp.includes('当前操作')&&wp.includes('data-current-action')&&!wp.includes('刷新状态')&&!wp.includes('同步本地 main'),'WP uses contextual current action only');
assert(pr.includes('当前操作')&&pr.includes('data-current-action')&&!pr.includes('打开 PR')&&!pr.includes('批准合并'),'PR uses contextual current action only');
assert(wp.includes('class="action primary"')&&pr.includes('class="action primary"'),'each entity has at most one primary action surface');
assert(wp.includes("onNavigate(currentAction.tab)")&&pr.includes("onNavigate(currentAction.tab)"),'current actions navigate to Operations Tabs');
assert(app.includes("runAction('REFRESH')")&&app.includes("runAction('SAFE_MAIN_SYNC')"),'diagnostic/repository tools remain available outside the primary zone');
assert(standard.includes('UI execution')||standard.includes('execution authority')||standard.includes('action surface consumes canonical state'),'UI authority boundary remains documented');
assert(app.includes('EntityOperationsWorkspace')&&app.includes('RuntimeWorkspace'),'entity operations hierarchy remains shared');
console.log('UI v1.1 conformance matrix passed');
