import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../components/entity/RuntimeWorkspace.svelte',import.meta.url),'utf8');

assert.match(app,/api\/gpt-bridge\/inbox/,'AICC polls the canonical Inbox endpoint');
assert.match(app,/bridgeInboxInitialized/,'initial Inbox items establish a baseline');
assert.match(app,/sourceType==='WEB_BRIDGE'/,'only incoming Web Bridge items trigger focus');
assert.match(app,/activeTab='运行'/,'incoming items open the Runtime tab');
assert.match(app,/selectedInboxId=item\.id/,'the exact incoming Inbox ID is selected');
assert.match(app,/taskRecords\.find\(record=>record\.inboxId===item\.id/,'incoming Inbox resolves through canonical Task registry identity');
assert.match(app,/if\(task\)selectCanonicalTask\(task\.taskId\)/,'incoming Task opens through the global Task selection authority');
assert.match(app,/incomingEntity\(item\)/,'entity selection comes from Inbox identity');
assert.match(app,/entityType\?\?''\)\.toLowerCase\(\)/,'normalized protocol entity type reaches navigation');
assert.match(app,/startIncomingInboxPolling/,'incoming detection runs without an active Runtime');
assert.match(app,/bridgePollInFlight/,'incoming polling prevents overlap');
assert.equal(app.includes('window.location.reload'),false,'incoming focus never hard-reloads the page');
assert.match(app,/onDestroy\(\(\)=>\{[^}]*if\(runtimeTimer\)clearInterval\(runtimeTimer\)/,'runtime polling is cleaned up');
assert.match(app,/onDestroy\(\(\)=>\{[^}]*if\(serviceTimer\)clearInterval\(serviceTimer\)/,'service polling is cleaned up');
assert.match(app,/onDestroy\(\(\)=>\{[^}]*if\(bridgeTimer\)clearInterval\(bridgeTimer\)/,'incoming polling is cleaned up');
assert.match(workspace,/selectedInboxId/,'Runtime Workspace retains the exact Inbox binding contract');
assert.match(workspace,/CanonicalTaskFeed/,'focused canonical Task appears through the unified Feed');
assert.doesNotMatch(app,/inbox-item-\$\{CSS\.escape\(item\.id\)\}/,'incoming focus no longer targets a removed Inbox card');
assert.match(app,/selectedInboxId=\{selectedInboxId\}/,'WP Runtime Workspace receives the focused Inbox');
assert.equal((app.match(/<RuntimeWorkspace/g)??[]).length,3,'selected Task, PR, and WP retain the shared Runtime Workspace component');
console.log('incoming Inbox focus contract tests passed');
