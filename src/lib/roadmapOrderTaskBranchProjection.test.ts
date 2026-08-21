import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mergeRoadmapNodes} from './model/projectModel.ts';
import type {RoadmapNode} from './workflow.ts';
import {projectCanonicalTaskRegistry,resolveCanonicalTaskBranch} from './bridgeCore.ts';

const milestone=(id:string):RoadmapNode=>({id,type:'milestone',title:id,status:'NOT_STARTED',progress:0,parentId:null,children:[]});
const local=[milestone('M5'),milestone('M1'),milestone('M4.1'),milestone('M4'),milestone('M11.5')];
const github=[milestone('M1'),milestone('M4'),milestone('M4.1'),milestone('M5'),milestone('M11'),milestone('M11.5')];
const canonical=mergeRoadmapNodes(local,github);
assert.deepEqual(canonical.map(node=>node.id),['M1','M4','M4.1','M5','M11','M11.5'],'dual-source union follows semantic milestone identity order');
assert.equal(canonical.filter(node=>node.id==='M5').length,1,'M5 has one canonical occurrence');
assert.equal(new Set(canonical.map(node=>node.id)).size,canonical.length,'canonical milestone count equals unique identity count');
const selected='M5';
assert.deepEqual(mergeRoadmapNodes(local,github).map(node=>node.id),canonical.map(node=>node.id),'selection does not alter canonical Roadmap composition');
assert.ok(canonical.some(node=>node.id===selected),'selected milestone remains locatable at its canonical position');

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const locator=readFileSync(new URL('../components/CurrentContextLocator.svelte',import.meta.url),'utf8');
const projectModel=readFileSync(new URL('./model/projectModel.ts',import.meta.url),'utf8');
assert.match(app,/function locateSelectedEntity\(\)/,'locate behavior remains available');
assert.match(app,/roadmapPath\(roadmapNodes,targetId\)/,'locate resolves the canonical locked or navigation target path');
assert.match(app,/scrollTo\(\{top:/,'locate scrolls without changing node order');
assert.doesNotMatch(locator,/current-context-row/,'Current Context does not render a selected entity as an extra Roadmap row');
assert.match(locator,/aria-label=\{workspace==='TASK'\?\(selectedTaskId\?'定位当前任务':'暂无当前任务'\):'定位到当前上下文'\}/,'Current Context keeps an accessible truthful locate target');
assert.match(projectModel,/resolveRoadmapSyncState/,'dual-source sync-state resolver remains connected');

const task=(overrides:Record<string,unknown>={})=>({registryVersion:2,recordType:'CANONICAL_TASK',taskId:'task-1',inboxId:'inbox-1',instructionId:'instruction-1',executionId:'execution-1',runId:'run-1',entityScope:'GLOBAL_TASK',workPackageId:null,prId:null,repository:'AIcontrolcenter',branch:'UNAVAILABLE',origin:'OWNER_CREATED',status:'COMPLETED',createdAt:'2026-08-15T01:00:00.000Z',updatedAt:'2026-08-15T01:01:00.000Z',instruction:{entityScope:'GLOBAL_TASK'},rawInstruction:'read only',...overrides}) as any;
assert.equal(resolveCanonicalTaskBranch(task({branch:'persisted/task'}),[{execution_id:'execution-1',branch:'execution/context'}],[{runId:'run-1',branch:'runtime/branch'}]),'persisted/task','canonical persisted Task branch has precedence');
assert.equal(resolveCanonicalTaskBranch(task(),[{execution_id:'execution-1',branch:'execution/context'}],[{runId:'run-1',branch:'runtime/branch'}]),'execution/context','correlated execution context supplies missing Task branch');
assert.equal(resolveCanonicalTaskBranch(task(),[],[{runId:'run-1',branch:'runtime/branch'}]),'runtime/branch','correlated Run supplies missing Task branch');
assert.equal(resolveCanonicalTaskBranch(task({runId:undefined,executionId:undefined}),[],[]),'NOT_AVAILABLE','unexecuted Task does not infer the current UI or repository branch');
const input=[task()],snapshot=structuredClone(input);
const projection=projectCanonicalTaskRegistry(input,[],[{runId:'run-1',branch:'rebuild/aicc-v2'}]);
assert.equal(projection.items[0].branch,'rebuild/aicc-v2','All Tasks projects the actual correlated execution branch');
assert.deepEqual(input,snapshot,'branch projection never mutates the canonical Task Registry');
assert.equal(projection.items[0].taskId,'task-1','branch enrichment preserves canonical Task identity');
assert.equal(projection.items[0].createdAt,input[0].createdAt,'branch enrichment preserves canonical Task timestamps');

console.log('roadmap order and task branch projection tests passed');
