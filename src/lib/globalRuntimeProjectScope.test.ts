import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createEmptyGlobalStateReadModel,queryGlobalStateForProject} from './globalStateReadModel.ts';

const root=process.cwd();
const app=readFileSync(join(root,'src/App.svelte'),'utf8');
const server=readFileSync(join(root,'vite.config.ts'),'utf8');

assert.match(app,/async function refreshGlobalRuntimeProjection\(\)\{[\s\S]*?const pq=projectQuery\(\)/,'global runtime polling derives the frozen active project scope');
assert.match(app,/pq\?request\(`\/api\/codex\/runtime\?entityType=global_task&entityId=GLOBAL_TASK&\$\{pq\}`\):Promise\.resolve\(\{info:null,runtime:null,history:\[\],availability:'NOT_AVAILABLE'\}\)/,'global runtime request carries project scope and fails closed without it');
assert.match(server,/\(entityType==='work_package'\|\|entityType==='global_task'\|\|legacyId\)&&!scope/,'server requires project scope for global_task runtime reads');
assert.ok(server.includes("history.filter(item=>!scope||(entityType==='global_task'?runtimeBelongsToProject(item,scope):scopedWpRecord(item,scope))).filter(matches)"),'runtime history is project-filtered before entity filtering');

const scopeA={projectId:'project-a',repositoryIdentity:'repo/a',projectContextRevision:1} as const;
const scopeB={projectId:'project-b',repositoryIdentity:'repo/b',projectContextRevision:1} as const;
const globalA={runId:'shared-global-run',entityType:'global_task',entityId:'GLOBAL_TASK',projectId:scopeA.projectId,repositoryIdentity:scopeA.repositoryIdentity};
const globalB={runId:'shared-global-run',entityType:'global_task',entityId:'GLOBAL_TASK',projectId:scopeB.projectId,repositoryIdentity:scopeB.repositoryIdentity};
const modelA=queryGlobalStateForProject(scopeA,{entities:[],bindings:[]},createEmptyGlobalStateReadModel(scopeA),undefined,{runtimeHistory:[globalA,globalB]});
const modelB=queryGlobalStateForProject(scopeB,{entities:[],bindings:[]},createEmptyGlobalStateReadModel(scopeB),undefined,{runtimeHistory:[globalA,globalB]});
assert.deepEqual(modelA.scopedRuntimeHistory.map((item:any)=>item.projectId),['project-a'],'project A cannot see project B global runtime history with the same raw runId');
assert.deepEqual(modelB.scopedRuntimeHistory.map((item:any)=>item.projectId),['project-b'],'project B cannot see project A global runtime history with the same raw runId');

console.log('global runtime project scope regression passed');
