import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {scopeBridgeRecords} from './projectScopedBridgeCollections.ts';

const scopeA={projectId:'project-a',repositoryIdentity:'repo/a'};
const scopeB={projectId:'project-b',repositoryIdentity:'repo/b'};
const sameRun='shared-bridge-run';
const records=[
  {id:'a',runId:sameRun,...scopeA},
  {id:'b',runId:sameRun,...scopeB},
  {id:'legacy',runId:sameRun}
];
assert.deepEqual(scopeBridgeRecords(records,scopeA).map(item=>item.id),['a'],'project A sees only its bridge record despite colliding raw runId');
assert.deepEqual(scopeBridgeRecords(records,scopeB).map(item=>item.id),['b'],'project B sees only its bridge record despite colliding raw runId');
assert.deepEqual(scopeBridgeRecords(records,null),[],'bridge collections fail closed without project scope');

const app=readFileSync(join(process.cwd(),'src/App.svelte'),'utf8');
assert.match(app,/const items=scopeBridgeRecords\(inbox\.items\?\?\[\],activeRoadmapProject\)/,'initial bridge inbox ingestion is project scoped');
assert.match(app,/bridgeOutbox=scopeBridgeRecords\(outbox\.items\?\?\[\],activeRoadmapProject\)/,'initial bridge outbox ingestion is project scoped');
assert.match(app,/const notificationItems=scopeBridgeRecords\(notifications\.items\?\?\[\],activeRoadmapProject\)/,'notification ingestion is project scoped before run correlation');
assert.match(app,/const items=scopeBridgeRecords\(response\.items\?\?\[\],activeRoadmapProject\)/,'incoming inbox polling is project scoped');
console.log('app bridge collection project scope regression passed');
