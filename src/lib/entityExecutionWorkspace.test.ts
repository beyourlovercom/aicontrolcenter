import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../components/entity/RuntimeWorkspace.svelte',import.meta.url),'utf8');
const runtime=readFileSync(new URL('./runtimeManager.ts',import.meta.url),'utf8');
const bridge=readFileSync(new URL('./bridgeCore.ts',import.meta.url),'utf8');
const model=readFileSync(new URL('./model/entityTypes.ts',import.meta.url),'utf8');

assert(app.includes('RuntimeWorkspace runtime={displayRuntime}'),'WP uses the shared execution workspace');
assert(app.includes('RuntimeWorkspace entityType="pull_request"'),'PR uses the shared execution workspace');
assert.equal((app.match(/<RuntimeWorkspace/g)??[]).length,2,'only one runtime implementation is composed for two entity types');
assert(workspace.includes('粘贴指令')&&workspace.includes('导入指令')&&workspace.includes('执行指令'),'shared workspace exposes the instruction composer');
assert(workspace.includes('当前执行')&&workspace.includes('运行监控 / 实时活动')&&workspace.includes('结果发件箱'),'shared workspace exposes execution, monitor and result surfaces');
assert(runtime.includes("entityType?: 'work_package'|'pull_request'")&&runtime.includes('entityId?: string'),'runtime state has explicit entity binding');
assert(runtime.includes('item.entityType === entityType && item.entityId === entityId'),'runtime reads are entity scoped');
assert(bridge.includes('startRuntime(item.instruction.entityId')&&bridge.includes('entityType,entityId'),'Bridge launch forwards the selected entity binding');
assert(model.includes("runtime:RuntimeRecord|null"),'PR context carries its selected runtime projection');
assert(app.includes('executionContext:executionTarget'),'composer imports bind the selected entity context');
assert(app.includes('scopedRuntimeHistory'),'history is filtered before entering the shared workspace');
assert(!app.includes('PR_EXECUTION_CONTRACT_NOT_BOUND'),'PR execution is not a placeholder block');
console.log('entity execution workspace matrix passed');
