import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../components/entity/RuntimeWorkspace.svelte',import.meta.url),'utf8');

assert.match(app,/api\/gpt-bridge\/inbox/,'AICC polls the canonical Inbox endpoint');
assert.match(app,/bridgeInboxInitialized/,'initial Inbox items establish a baseline');
assert.match(app,/sourceType==='WEB_BRIDGE'/,'only incoming Web Bridge items trigger focus');
assert.match(app,/activeTab='运行'/,'incoming items open the Runtime tab');
assert.match(app,/selectedInboxId=item\.id/,'the exact incoming Inbox ID is selected');
assert.match(app,/incomingEntity\(item\)/,'entity selection comes from Inbox identity');
assert.match(app,/entityType\?\?''\)\.toLowerCase\(\)/,'normalized protocol entity type reaches navigation');
assert.match(app,/startIncomingInboxPolling/,'incoming detection runs without an active Runtime');
assert.match(app,/bridgePollInFlight/,'incoming polling prevents overlap');
assert.equal(app.includes('window.location.reload'),false,'incoming focus never hard-reloads the page');
assert.match(app,/onDestroy\(\(\)=>\{if\(runtimeTimer\)clearInterval\(runtimeTimer\);if\(serviceTimer\)clearInterval\(serviceTimer\);if\(bridgeTimer\)clearInterval\(bridgeTimer\)/,'incoming polling is cleaned up');
assert.match(workspace,/selectedInboxId/,'Runtime Workspace accepts the exact Inbox focus');
assert.match(workspace,/inspectedInboxId=selectedInboxId/,'focused Inbox is expanded in the Runtime Workspace');
assert.match(app,/selectedInboxId=\{selectedInboxId\}/,'WP Runtime Workspace receives the focused Inbox');
assert.equal((app.match(/<RuntimeWorkspace/g)??[]).length,2,'PR and WP retain the shared Runtime Workspace component');
console.log('incoming Inbox focus contract tests passed');
