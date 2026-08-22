import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createEmptyGlobalStateReadModel,queryGlobalStateForProject} from './globalStateReadModel.ts';

const root=process.cwd();
const app=readFileSync(join(root,'src/App.svelte'),'utf8');
const server=readFileSync(join(root,'vite.config.ts'),'utf8');
const runtimeManager=readFileSync(join(root,'src/lib/runtimeManager.ts'),'utf8');

assert.match(app,/async function refreshRuntimeProjection\(\)\{[\s\S]*?const pq=projectQuery\(\);const query=pq\?`\?entityType=/,'entity runtime polling derives active project scope');
assert.match(app,/query\?request\(`\/api\/codex\/runtime\$\{query\}`\):Promise\.resolve\(\{info:null,runtime:null,history:\[\],availability:'NOT_AVAILABLE'\}\)/,'entity runtime polling fails closed without project scope');
assert.match(server,/if\(!scope\)return json\(res,\{info:null,runtime:null,history:\[\],availability:'NOT_AVAILABLE'\}\)/,'server requires project scope for every runtime read, including PR');
assert.match(runtimeManager,/entityType==='work_package'\|\|entityType==='pull_request'\|\|entityType==='global_task'/,'runtime read-only lookup treats PR as project-scoped');

const scopeA={projectId:'project-a',repositoryIdentity:'repo/a',projectContextRevision:1} as const;
const scopeB={projectId:'project-b',repositoryIdentity:'repo/b',projectContextRevision:1} as const;
const prA={runId:'shared-pr-run',entityType:'pull_request',entityId:'42',projectId:scopeA.projectId,repositoryIdentity:scopeA.repositoryIdentity};
const prB={runId:'shared-pr-run',entityType:'pull_request',entityId:'42',projectId:scopeB.projectId,repositoryIdentity:scopeB.repositoryIdentity};
const modelA=queryGlobalStateForProject(scopeA,{entities:[],bindings:[]},createEmptyGlobalStateReadModel(scopeA),undefined,{runtimeHistory:[prA,prB]});
const modelB=queryGlobalStateForProject(scopeB,{entities:[],bindings:[]},createEmptyGlobalStateReadModel(scopeB),undefined,{runtimeHistory:[prA,prB]});
assert.deepEqual(modelA.scopedRuntimeHistory.map((item:any)=>item.projectId),['project-a']);
assert.deepEqual(modelB.scopedRuntimeHistory.map((item:any)=>item.projectId),['project-b']);
console.log('PR runtime project scope regression passed');
