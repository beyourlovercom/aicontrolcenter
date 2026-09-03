import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../components/entity/RuntimeWorkspace.svelte',import.meta.url),'utf8');
const runtime=readFileSync(new URL('./runtimeManager.ts',import.meta.url),'utf8');
const bridge=readFileSync(new URL('./bridgeCore.ts',import.meta.url),'utf8');
const model=readFileSync(new URL('./model/entityTypes.ts',import.meta.url),'utf8');

assert.match(app,/RuntimeWorkspace projectContext=\{activeRoadmapProject\} runtime=\{displayRuntime\}/,'WP uses the shared execution workspace with canonical project context');
assert.match(app,/RuntimeWorkspace projectContext=\{activeRoadmapProject\} entityType="pull_request"/,'PR uses the shared execution workspace with canonical project context');
assert.match(app,/RuntimeWorkspace projectContext=\{activeRoadmapProject\} entityType=\{selectedTaskWorkPackageContext\?'work_package':'global_task'\}[\s\S]*runtime=\{selectedTaskRuntime\}/,'selected Task uses the shared execution workspace');
assert.equal((app.match(/<RuntimeWorkspace/g)??[]).length,3,'one shared runtime implementation is composed for selected Task, WP, and PR');
assert(workspace.includes('粘贴指令')&&workspace.includes('发送到 AICC 执行'),'shared workspace exposes the single explicit submission action');
assert(workspace.includes('当前执行')&&workspace.includes('运行摘要')&&workspace.includes('Runtime Monitor')&&workspace.includes('CanonicalTaskFeed'),'shared workspace exposes canonical Task, execution, and monitor surfaces');
assert(!workspace.includes('结果发件箱')&&!workspace.includes('runtime-history-card'),'Outbox and Run records are not competing Task lists');
assert(runtime.includes("entityType?: 'global_task'|'work_package'|'pull_request'")&&runtime.includes('entityId?: string'),'runtime state has explicit global, WP and PR entity binding');
assert(runtime.includes('item.entityType === entityType && item.entityId === entityId'),'runtime reads are entity scoped');
assert(bridge.includes('startRuntime(item.instruction.entityId')&&bridge.includes('entityType,entityId'),'Bridge launch forwards the selected entity binding');
assert(model.includes("runtime:RuntimeRecord|null"),'PR context carries its selected runtime projection');
assert(app.includes('executionContext:executionTarget'),'composer imports bind the selected entity context');
assert(app.includes('scopedRuntimeHistory'),'history is filtered before entering the shared workspace');
assert(!app.includes('PR_EXECUTION_CONTRACT_NOT_BOUND'),'PR execution is not a placeholder block');
console.log('entity execution workspace matrix passed');
