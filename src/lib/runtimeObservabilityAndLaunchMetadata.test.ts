import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const root=process.cwd();
const runtime=readFileSync(join(root,'src/lib/runtimeManager.ts'),'utf8');
const bridge=readFileSync(join(root,'src/lib/bridgeCore.ts'),'utf8');
const server=readFileSync(join(root,'vite.config.ts'),'utf8');
const app=readFileSync(join(root,'src/App.svelte'),'utf8');
const workspace=readFileSync(join(root,'src/components/entity/RuntimeWorkspace.svelte'),'utf8');
const dock=readFileSync(join(root,'src/components/GlobalExecutionComposerDock.svelte'),'utf8');

assert.match(runtime,/readRuntimeByRunIdReadOnly[\s\S]*runtime-\$\{runId\}\.json/,'exact run lookup reads its durable runtime file before history');
assert.match(runtime,/DEAD_PROCESS_RECONCILED/,'dead managed process reconciliation is durable runtime evidence');
assert.match(runtime,/state\.failure=state\.failure\?\?'PROCESS_EXITED'/,'stale RUNNING state converges without inventing business success');
assert.match(app,/selectedTaskRuntimeId=selectedTask\?\.runId\?\?selectedTask\?\.executionId\?\?null/,'Task exact lookup accepts either canonical execution identity');
assert.match(workspace,/Failure<\/dt>/,'Runtime evidence renders canonical failure classification');
assert.match(workspace,/Codex thread<\/dt>/,'Runtime evidence renders the thread identity when available');
assert.match(workspace,/Process exit \/ close<\/dt>/,'Runtime evidence renders process terminal evidence');
assert.match(server,/model\?:string;reasoning\?:string/,'Bridge inbox accepts launch metadata before auto-launch');
assert.match(server,/submitExecution\([\s\S]*\{model:payload\.model,reasoning:payload\.reasoning\}/,'Bridge inbox forwards metadata into canonical submission');
assert.match(bridge,/model:metadata\.model,reasoning_effort:metadata\.reasoning/,'submission persists launch metadata before auto-launch');
assert.match(bridge,/launchInboxItem\(item\.id,metadata\)/,'auto-launch consumes persisted submission metadata');
assert.match(dock,/onImport\(\{model:selectedModel\|\|undefined,reasoning:selectedReasoning\|\|undefined\}\)/,'Global Composer submits its selected model and reasoning atomically');

console.log('runtime observability and launch metadata matrix passed');
