import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readFormalWorkPackageRegistry,isRegisteredFormalWorkPackage} from './controlService.ts';
import {parseExecutionV1,projectCanonicalTaskRegistry,reconcileTaskBindingRecord,reconcileTaskBindingRecords,type CanonicalTaskRecord} from './bridgeCore.ts';
import {buildGlobalTaskGroups} from './globalTaskView.ts';
import {scopeTasksToEntity} from './entityScope.ts';
import {reconcileRuntimeEntityBinding,type RuntimeState} from './runtimeManager.ts';
import {BRIDGE_TASK_CATALOG,FORMAL_BRIDGE_WP_ID,classifyEntityIdentity,parseFormalWorkPackageRegistry,resolveTaskEntityBinding} from './taskEntityBinding.ts';

const roadmap=readFileSync(new URL('../../docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md',import.meta.url),'utf8');
const registry=readFormalWorkPackageRegistry();
const bridgeRegistration=registry.get(FORMAL_BRIDGE_WP_ID);
assert.equal(bridgeRegistration?.milestoneId,'M8','formal Bridge WP resolves through Roadmap registry to M8');
assert.equal(bridgeRegistration?.milestoneTitle,'M8 — AICC Lifecycle Intelligence');
assert.equal(isRegisteredFormalWorkPackage(FORMAL_BRIDGE_WP_ID),true);
assert.equal(isRegisteredFormalWorkPackage('AICC-M8.2.1.6-BRIDGE-CODEX-MODEL-SELECTOR-001'),false,'pseudo-WP cannot acquire formal Roadmap authority');
assert.equal(classifyEntityIdentity('AICC-M8.2.1.6-BRIDGE-CODEX-MODEL-SELECTOR-001',registry),'TASK');
assert.equal(classifyEntityIdentity(FORMAL_BRIDGE_WP_ID,registry),'FORMAL_WP');

const modelSelector=resolveTaskEntityBinding({instructionId:'m8.2.1.6-bridge-codex-model-selector-001',entityId:'AICC-M8.2.1.6-BRIDGE-CODEX-MODEL-SELECTOR-001'},registry);
assert.equal(modelSelector.entityClass,'TASK');
assert.equal(modelSelector.formalWpId,FORMAL_BRIDGE_WP_ID);
assert.equal(modelSelector.phaseId,'M8.2');
assert.equal(modelSelector.milestoneId,'M8');
assert.equal(modelSelector.legacyEntityReference,'AICC-M8.2.1.6-BRIDGE-CODEX-MODEL-SELECTOR-001','historical pseudo-WP identity is retained separately');

const unknown=resolveTaskEntityBinding({instructionId:'m8.2.1.99-unknown-001',entityId:'AICC-M8.2.1.99-UNKNOWN-001'},registry);
assert.equal(unknown.bindingState,'UNMAPPED');
assert.equal(unknown.formalWpId,null);
assert.equal(unknown.milestoneId,null,'unknown task strings never invent a milestone');

const instruction=(instructionId:string,entityId:string,sourceType:'CLIPBOARD_DIRECT'|'WEB_BRIDGE'='CLIPBOARD_DIRECT')=>({version:'AICC_EXECUTION_V1',instructionId,entityType:'WORK_PACKAGE',entityId,workPackageId:entityId,executionType:'IMPLEMENTATION',repository:'/Users/a/AI/007/AIcontrolcenter',branch:'rebuild/aicc-v2',expectedHead:'head',sandbox:'workspace-write',requiresAuthorization:false,instructionBody:'Execute.',rawInstruction:`AICC_EXECUTION_V1\nINSTRUCTION_ID: ${instructionId}\nENTITY_TYPE: WORK_PACKAGE\nENTITY_ID: ${entityId}\nEXECUTION_TYPE: IMPLEMENTATION\nREPOSITORY: /Users/a/AI/007/AIcontrolcenter\nBRANCH: rebuild/aicc-v2\nEXPECTED_HEAD: head\nSANDBOX: workspace-write\nINSTRUCTION_BEGIN\nExecute.\nINSTRUCTION_END`,sourceType,ownerDirectExecution:sourceType==='CLIPBOARD_DIRECT',receivedAt:'2026-08-15T00:00:00.000Z',entityScope:'WORK_PACKAGE',prId:null} as const);
const task=(taskId:string,instructionId:string,entityId:string,runId:string):CanonicalTaskRecord=>({registryVersion:2,recordType:'CANONICAL_TASK',taskId,inboxId:instructionId,instructionId,executionId:runId,runId,entityScope:'WORK_PACKAGE',workPackageId:entityId,prId:null,repository:'/Users/a/AI/007/AIcontrolcenter',branch:'rebuild/aicc-v2',origin:'CLIPBOARD_DIRECT',provider:'codex',status:'COMPLETED',createdAt:'2026-08-15T00:00:00.000Z',updatedAt:'2026-08-15T01:00:00.000Z',instruction:instruction(instructionId,entityId),rawInstruction:instruction(instructionId,entityId).rawInstruction});
const legacyTask=task('task-model-selector','m8.2.1.6-bridge-codex-model-selector-001','AICC-M8.2.1.6-BRIDGE-CODEX-MODEL-SELECTOR-001','run-model-selector');
const normalized=reconcileTaskBindingRecord(legacyTask,registry);
assert.equal(normalized.taskId,legacyTask.taskId);assert.equal(normalized.instructionId,legacyTask.instructionId);assert.equal(normalized.runId,legacyTask.runId);assert.equal(normalized.executionId,legacyTask.executionId);
assert.equal(normalized.workPackageId,legacyTask.workPackageId,'legacy raw ownership field is not rewritten');
assert.equal(normalized.formal_wp_id,FORMAL_BRIDGE_WP_ID);assert.equal(normalized.entity_class,'TASK');assert.equal(normalized.phase_id,'M8.2');assert.equal(normalized.milestone_id,'M8');assert.equal(normalized.origin_source,'CLIPBOARD_DIRECT');assert.equal(normalized.run_id,'run-model-selector');assert.equal(normalized.execution_id,'run-model-selector');
assert.equal(normalized.instruction.entityId,legacyTask.instruction.entityId,'instruction identity remains immutable');

const family=[legacyTask,task('task-result','m8.2.1.4-codex-result-insert-reliability-001','AICC-M8.2.1.4-CODEX-RESULT-INSERT-RELIABILITY-001','run-result')];
const first=reconcileTaskBindingRecords(family,registry),second=reconcileTaskBindingRecords(first,registry);
assert.deepEqual(second,first,'binding reconciliation is idempotent');
assert.equal(new Set(first.map(item=>item.formal_wp_id)).size,1,'multiple Bridge tasks project under one formal WP');
assert.equal(scopeTasksToEntity(first,{type:'work_package',id:FORMAL_BRIDGE_WP_ID}).length,2,'WP detail finds tasks through normalized ownership');
assert.equal(buildGlobalTaskGroups(first).recentCompleted.length,2,'normalized tasks remain globally visible without duplicate rows');
assert.equal(projectCanonicalTaskRegistry([...first,{...first[0]}]).items.filter(item=>item.taskId==='task-model-selector').length,1,'canonical task identity still prevents duplicate rows');

const clipboard=parseExecutionV1(instruction('m8.2.1.3-bridge-clipboard-codex-execution-001','AICC-M8.2.1.3').rawInstruction,'CLIPBOARD_DIRECT');
assert.equal(clipboard.ownerDirectExecution,true);assert.equal(clipboard.formalWpId,FORMAL_BRIDGE_WP_ID);assert.equal(clipboard.milestoneId,'M8');assert.equal(clipboard.entityClass,'TASK');
const future=parseExecutionV1(instruction('m8.2.1.7-task-wp-roadmap-binding-normalization-001',FORMAL_BRIDGE_WP_ID).rawInstruction.replace('EXECUTION_TYPE:','PHASE_ID: M8.2\nTASK_ID: m8.2.1.7-task-wp-roadmap-binding-normalization-001\nEXECUTION_TYPE:'));
assert.equal(future.formalWpId,FORMAL_BRIDGE_WP_ID);assert.equal(future.phaseId,'M8.2');assert.equal(future.declaredTaskId,'m8.2.1.7-task-wp-roadmap-binding-normalization-001');

const runtime={runId:'run-model-selector',workPackageId:'AICC-M8.2.1.6-BRIDGE-CODEX-MODEL-SELECTOR-001',entityType:'work_package',entityId:'AICC-M8.2.1.6-BRIDGE-CODEX-MODEL-SELECTOR-001',authorizationId:'pass-through',authoritySha:'NOT_APPLICABLE',branch:'rebuild/aicc-v2',startingHeadSha:'head',pid:null,threadId:null,phase:'COMPLETED',currentTask:'done',latestEvent:'turn.completed',startedAt:'2026-08-15T00:00:00.000Z',lastActivityAt:'2026-08-15T01:00:00.000Z',events:[],instructionId:'clipboard-wrapper',instructionText:legacyTask.rawInstruction,canonicalResult:{version:'AICC_EXECUTION_RESULT_V1',executionId:'run-model-selector',aiccStatus:'RESULT_RECEIVED',rawResult:'PASS',receivedAt:'2026-08-15T01:00:00.000Z',resultId:'result-model-selector',resultHash:'immutable-result-hash',returnState:'RESULT_READY'}} as RuntimeState;
const runtimeNormalized=reconcileRuntimeEntityBinding(runtime,registry);
assert.equal(runtimeNormalized.runId,runtime.runId);assert.equal(runtimeNormalized.canonicalResult?.resultId,runtime.canonicalResult?.resultId);assert.equal(runtimeNormalized.canonicalResult?.resultHash,runtime.canonicalResult?.resultHash);assert.equal(runtimeNormalized.formalWpId,FORMAL_BRIDGE_WP_ID);assert.equal(runtimeNormalized.legacyEntityReference,runtime.entityId);

const active=roadmap.split('## Active V2 Milestones')[1].split('## Legacy Historical Milestones')[0];
assert.equal((active.match(/AICC-V2-GPT-CODEX-BRIDGE-001/g)??[]).length,1,'active Roadmap registers exactly one formal Bridge WP');
for(const entry of BRIDGE_TASK_CATALOG)assert.equal(parseFormalWorkPackageRegistry(roadmap).has(`AICC-${entry.taskCode}`),false,'task catalog entries never become Roadmap WPs');
const detail=readFileSync(new URL('../components/GlobalTaskDetail.svelte',import.meta.url),'utf8'),app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8'),feedProjection=readFileSync(new URL('./canonicalTaskFeed.ts',import.meta.url),'utf8');
for(const label of ['Formal Work Package','Phase','Task','Origin','Run ID','Execution ID','Provider','Evidence'])assert.match(detail,new RegExp(label));
assert.match(app,/tasks=\{scopedTaskRecords\}/);assert.match(feedProjection,/task\.taskTitle\?\?task\.taskCode/);assert.match(feedProjection,/task\.origin_source\?\?task\.origin/);assert.match(feedProjection,/task\.formalWpId\?\?task\.formal_wp_id/);
console.log('M8.2.1.7 Task / WP / Roadmap binding normalization matrix passed');
