import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createEmptyGlobalStateReadModel,queryGlobalStateForProject} from './globalStateReadModel.ts';

const root=process.cwd();
const app=readFileSync(join(root,'src/App.svelte'),'utf8');
const server=readFileSync(join(root,'vite.config.ts'),'utf8');
const runtimeManager=readFileSync(join(root,'src/lib/runtimeManager.ts'),'utf8');

assert.match(app,/const pq=projectQuery\(\);const runtimeQuery=pq\?\(\['work_package','pull_request'\]\.includes\(selectedAtStart\.type\)\?[\s\S]*:`\?\$\{pq\}`\):''/,'root snapshot runtime read carries project scope');
assert.match(app,/runtimeQuery\?boundedRequest\(`\/api\/codex\/runtime\$\{runtimeQuery\}`\):Promise\.resolve\(\{info:null,runtime:null,history:\[\],availability:'NOT_AVAILABLE'\}\)/,'root snapshot fails closed without project scope');
assert.match(server,/const scope=requestProjectScope[\s\S]*?if\(!scope\)return json\(res,\{info:null,runtime:null,history:\[\],availability:'NOT_AVAILABLE'\}\)/,'HTTP runtime reads require project scope');
assert.ok(server.includes('history.filter(item=>runtimeBelongsToProject(item,scope)).filter(matches)'),'all scoped runtime history uses project identity filtering');
assert.ok(runtimeManager.includes('if(projectScope&&!runtimeBelongsToProject(item,projectScope))return false'),'root runtime lookup applies supplied project scope even without entity type');

const scopeA={projectId:'project-a',repositoryIdentity:'repo/a',projectContextRevision:1} as const;
const scopeB={projectId:'project-b',repositoryIdentity:'repo/b',projectContextRevision:1} as const;
const rootA={runId:'same-root-run',entityType:'global_task',entityId:'GLOBAL_TASK',projectId:scopeA.projectId,repositoryIdentity:scopeA.repositoryIdentity};
const rootB={runId:'same-root-run',entityType:'global_task',entityId:'GLOBAL_TASK',projectId:scopeB.projectId,repositoryIdentity:scopeB.repositoryIdentity};
const modelA=queryGlobalStateForProject(scopeA,{entities:[],bindings:[]},createEmptyGlobalStateReadModel(scopeA),undefined,{runtimeHistory:[rootA,rootB]});
const modelB=queryGlobalStateForProject(scopeB,{entities:[],bindings:[]},createEmptyGlobalStateReadModel(scopeB),undefined,{runtimeHistory:[rootA,rootB]});
assert.deepEqual(modelA.scopedRuntimeHistory.map((item:any)=>item.projectId),['project-a']);
assert.deepEqual(modelB.scopedRuntimeHistory.map((item:any)=>item.projectId),['project-b']);
console.log('root runtime project scope regression passed');
