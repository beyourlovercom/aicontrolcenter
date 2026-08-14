import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
assert.match(app,/aicc-v2-workspace-navigation/,'workspace navigation has one persistence key');
assert.match(app,/entity:selectedEntity,activeTab,selectedInboxId,selectedRunId/,'entity, tab, Inbox and Run share one navigation record');
assert.match(app,/WORKSPACE_TABS\.includes\(initialWorkspace\.activeTab/,'active tab is restored only when valid');
assert.match(app,/selectedInboxId=initialWorkspace\.selectedInboxId\?\?null/,'selected Inbox is restored at startup');
assert.match(app,/selectedRunId=initialWorkspace\.selectedRunId\?\?null/,'selected Run is restored at startup');
assert.match(app,/if\(selectedInboxId&&!items\.some\(\(item:any\)=>item\.id===selectedInboxId\)\)selectedInboxId=null/,'missing persisted Inbox is cleared');
assert.match(app,/persistedRun=selectedRunId&&runtimeHistory\.some/,'persisted Run is validated against canonical history');
assert.match(app,/\['STARTING','RUNNING','STOPPING'\]\.includes\(next\.runtime\.phase\)\?next\.runtime\.runId:persistedRun/,'canonical active Run overrides stale persisted Run');
assert.doesNotMatch(app,/selectedEntity=hydrated;activeTab='概览'/,'refresh does not reset a valid tab to Overview');
assert.match(app,/finally\(startIncomingInboxPolling\)/,'incoming polling remains enabled after startup');
assert.equal((app.match(/aicc-v2-(?:selected-entity|workspace-navigation)/g)??[]).filter(key=>key==='aicc-v2-selected-entity').length,0,'legacy navigation key is not used');
console.log('workspace navigation persistence tests passed');
