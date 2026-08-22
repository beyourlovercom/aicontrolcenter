import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createEmptyGlobalStateReadModel,entityIdentity,resolveExplicitBindings} from './globalStateReadModel.ts';
import {createProjectSnapshot} from './model/projectModel.ts';
import {projectGlobalWorkPackages} from './globalWorkspaceProjection.ts';
import {projectWpLayer2,projectWpRoadmapNodes,ROADMAP_GROUP_IS_ENTITY,WP_IDENTITY_KEY,WP_ID_PREFIX_DEPENDENCY,WP_MILESTONE_BINDING_SOURCE,WP_PR_BINDING_INFERENCE_AUTHORITY,WP_PROGRESS_INFERENCE_AUTHORITY,WP_ROADMAP_GROUP_SOURCE,WP_TASK_BINDING_INFERENCE_AUTHORITY} from './wpCanonicalProjection.ts';

const wpA='UNPREFIXED-WP-ALPHA',wpB='WP-BETA';
const scope={projectId:'aicc',repositoryIdentity:'beyourlovercom/aicontrolcenter',projectContextRevision:0};
const roadmap=(alphaTitle='Alpha canonical')=>`## Active V2 Milestones
### M8 — Canonical parent

#### 8.2 — Canonical display grouping
Work Packages: \`${wpA}\`
\`${wpA}\` — \`PLANNED\`; ${alphaTitle}.

### M4 — Independent parent
Work Packages: \`${wpB}\`
\`${wpB}\` — \`PLANNED\`; Beta canonical.

## Legacy Historical Milestones`;
const snapshot=(content=roadmap(),extras:Record<string,unknown>={})=>createProjectSnapshot({roadmap:{source:'docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md',content},formalWorkPackages:{},...extras});

const explicitTask={taskId:'task-a',bindingState:'BOUND' as const,formalWpId:wpA,instruction:{bindingState:'BOUND' as const,formalWpId:wpA}};
const inferredTask={taskId:'task-ignore',workPackageId:wpA,instruction:{workPackageId:wpA}};
const explicitPr={id:'pr-a',repository:scope.repositoryIdentity,number:7,workPackageId:wpA,status:'IN_PROGRESS' as const,correlationSource:'EXTERNAL_FACT' as const};
const inferredPr={id:'pr-ignore',repository:scope.repositoryIdentity,number:8,workPackageId:wpA,status:'COMPLETE' as const,correlationSource:'UNKNOWN' as const};

const first=projectWpLayer2(createEmptyGlobalStateReadModel(scope),snapshot(),[explicitTask,inferredTask],scope);
const alpha=first.records.find(record=>record.id===wpA)!;
const beta=first.records.find(record=>record.id===wpB)!;
assert.equal(WP_IDENTITY_KEY,'CANONICAL_WORK_PACKAGE_ID');
assert.equal(alpha.id,wpA,'canonical roadmap ID is the WP identity');
assert.equal(WP_ID_PREFIX_DEPENDENCY,false,'AICC prefix is not an existence gate');
assert.equal(first.records.length,2,'structural Roadmap WPs remain visible without formal docs, tasks, PRs, or runs');
assert.deepEqual(beta.taskIds,[]); assert.deepEqual(beta.prIds,[],'a zero-Task/zero-PR structural WP remains visible');
assert.equal(alpha.milestoneId,'M8');
assert.equal(alpha.milestoneTitle,'M8 — Canonical parent');
assert.equal(WP_MILESTONE_BINDING_SOURCE,'CANONICAL_ROADMAP_STRUCTURE');
assert.deepEqual(alpha.taskIds,['task-a'],'only an explicit canonical Task binding is projected');
assert.equal(resolveExplicitBindings(first.model,'WP_TO_TASK',entityIdentity(scope,'WORK_PACKAGE',alpha.id)).bindings.length,1);
assert.equal(WP_TASK_BINDING_INFERENCE_AUTHORITY,0);
assert.equal(alpha.prIds.length,0);
assert.equal(alpha.implementation.state,'UNKNOWN');
assert.equal(alpha.validation.state,'UNKNOWN');
assert.equal(alpha.uat.state,'UNKNOWN');
assert.equal(alpha.closure.state,'UNKNOWN');
assert.equal(alpha.progress.state,'UNKNOWN');
assert.equal(WP_PROGRESS_INFERENCE_AUTHORITY,0);

const withPr=projectWpLayer2(first.model,snapshot(roadmap(),{pullRequests:[explicitPr,inferredPr]}),[explicitTask,inferredTask],scope);
const alphaWithPr=withPr.records.find(record=>record.id===wpA)!;
assert.deepEqual(alphaWithPr.prIds,['7'],'only explicit PR binding is projected');
assert.equal(resolveExplicitBindings(withPr.model,'WP_TO_PR',entityIdentity(scope,'WORK_PACKAGE',alphaWithPr.id)).bindings.length,1);
assert.equal(WP_PR_BINDING_INFERENCE_AUTHORITY,0);
assert.notEqual(alphaWithPr.lifecycleStatus,'COMPLETE','Task/PR facts cannot fabricate WP completion');
const withTerminalRun=projectWpLayer2(withPr.model,snapshot(roadmap(),{pullRequests:[explicitPr],runtime:{runId:'completed-run',workPackageId:wpA,authorizationId:'auth',authoritySha:'sha',branch:'rebuild/aicc-v2',startingHeadSha:'sha',pid:null,threadId:null,phase:'COMPLETED',currentTask:'done',latestEvent:'done',startedAt:'now',lastActivityAt:'now',implementationResult:'CODE_CHANGE_PRESENT'}}),[explicitTask],scope);
assert.notEqual(withTerminalRun.records.find(record=>record.id===wpA)?.lifecycleStatus,'COMPLETE','a terminal Run cannot fabricate WP completion');

const withUat=projectWpLayer2(withPr.model,snapshot(roadmap(),{pullRequests:[explicitPr],humanUat:[{repository:scope.repositoryIdentity,workPackageId:wpA,entityType:'work_package',status:'PASS',items:[],createdAt:'now',updatedAt:'now',source:'Owner'}]}),[explicitTask],scope);
const alphaWithUat=withUat.records.find(record=>record.id===wpA)!;
assert.equal(alphaWithUat.uat.state,'KNOWN');
assert.equal(alphaWithUat.closure.state,'UNKNOWN','UAT does not infer closure');
assert.notEqual(alphaWithUat.lifecycleStatus,'COMPLETE','UAT PASS does not fabricate WP COMPLETE');

const noOp=projectWpLayer2(withUat.model,snapshot(roadmap(),{pullRequests:[explicitPr],humanUat:[{repository:scope.repositoryIdentity,workPackageId:wpA,entityType:'work_package',status:'PASS',items:[],createdAt:'now',updatedAt:'now',source:'Owner'}]}),[explicitTask],scope);
assert.equal(noOp.model.globalProjectionRevision,withUat.model.globalProjectionRevision,'no-op reprojection has no revision bump');
const changed=projectWpLayer2(noOp.model,snapshot(roadmap('Alpha changed'),{pullRequests:[explicitPr],humanUat:[{repository:scope.repositoryIdentity,workPackageId:wpA,entityType:'work_package',status:'PASS',items:[],createdAt:'now',updatedAt:'now',source:'Owner'}]}),[explicitTask],scope);
const beforeA=noOp.records.find(record=>record.id===wpA)!,beforeB=noOp.records.find(record=>record.id===wpB)!;
const afterA=changed.records.find(record=>record.id===wpA)!,afterB=changed.records.find(record=>record.id===wpB)!;
assert.ok(changed.model.globalProjectionRevision>noOp.model.globalProjectionRevision,'WP change participates in global revision');
assert.ok(afterA.entityProjectionRevision>beforeA.entityProjectionRevision,'exact changed WP increments entity revision');
assert.equal(afterB.entityProjectionRevision,beforeB.entityProjectionRevision,'unrelated WP does not mutate');
assert.equal(afterA.title,'Alpha changed');

const left=projectWpRoadmapNodes(snapshot(roadmap('Alpha changed')).roadmap.value??[],changed);
const center=projectGlobalWorkPackages(snapshot(roadmap('Alpha changed')),[explicitTask],changed).find(record=>record.workPackageId===wpA)!;
assert.equal(left.flatMap(milestone=>milestone.children).find(node=>node.id===wpA)?.id,center.workPackageId,'left and center retain the same canonical WP identity');
assert.equal(center.layer2,afterA,'center consumes the shared Layer 2 record');
const entityContextSource=readFileSync(new URL('./context/entityContext.ts',import.meta.url),'utf8');
assert.doesNotMatch(entityContextSource,/resolveLifecycleProgress\(lifecycle\.stages\)/,'WP progress remains UNKNOWN instead of being inferred from lifecycle stages');
assert.match(entityContextSource,/phaseProgress:wpProjection\.phaseProgress\?\?null/,'WP phase progress is consumed from the canonical WP projection');
const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
assert.match(app,/projectWpRoadmapNodes\(roadmapProjection\?\.nodes\?\?\[\],wpProjection\)/,'left WP state consumes Layer 2');
assert.match(app,/projectGlobalWorkPackages\(snapshot,globalTasks,wpProjection\)/,'center WP state consumes Layer 2');
assert.match(app,/resolveEntityContext\(snapshot,selectedEntity,prLayer2,wpProjection/,'right WP context consumes Layer 2');
assert.match(app,/function navigateGlobalEntity/,'existing WP selection and routing remain App-level');
assert.doesNotMatch(readFileSync(new URL('./wpCanonicalProjection.ts',import.meta.url),'utf8'),/M\\d\+.*prefix|startsWith\(['"]AICC/,'WP parent or existence prefix guessing is absent');

// No persisted WP snapshot is accepted by this adapter: the canonical Roadmap
// given to the projection is the only structural input, so stale rows cannot win.
const canonicalOnly=projectWpLayer2(createEmptyGlobalStateReadModel(scope),snapshot(roadmap('New canonical title')),[explicitTask],scope);
assert.equal(canonicalOnly.records.find(record=>record.id===wpA)?.title,'New canonical title','stale persisted WP projection cannot override canonical Roadmap structure');

// Phase 0.5: group provenance is carried by the shared WP Layer 2 record.
// The presentation grouping remains Roadmap metadata, never an entity or a
// lifecycle authority.
const canonicalRoadmap=readFileSync(new URL('../../docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md',import.meta.url),'utf8');
const m8Snapshot=createProjectSnapshot({roadmap:{source:'docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md',content:canonicalRoadmap},formalWorkPackages:{}});
const m8Projection=projectWpLayer2(createEmptyGlobalStateReadModel(scope),m8Snapshot,[],scope);
const m8Record=(id:string)=>m8Projection.records.find(record=>record.id===id)!;
assert.equal(m8Record('AICC_GLOBAL_CANONICAL_LIFECYCLE_PROJECTION_V1').roadmapGroupNumber,'8.3','canonical Roadmap grouping reaches the WP Layer 2 record');
assert.equal(m8Record('AICC_GLOBAL_CANONICAL_LIFECYCLE_PROJECTION_V1').roadmapGroupTitle,'Global Canonical Lifecycle Projection');
assert.equal(WP_ROADMAP_GROUP_SOURCE,'CANONICAL_ROADMAP_STRUCTURE');
assert.equal(ROADMAP_GROUP_IS_ENTITY,false);
assert.deepEqual(m8Projection.records.filter(record=>record.roadmapGroupNumber==='8.4').map(record=>record.id),['AICC_BRIDGE_RESULT_AUTO_RETURN_REGRESSION_V1','AICC_AUTO_LOOP_FEEDBACK_DELIVERY_AND_TURN_CORRELATION_V1'],'8.4 has exactly its canonical pair in canonical Roadmap order');
assert.equal(m8Record('WP-WORK-PACKAGE-Homepage-001').roadmapGroupNumber,'8.5','non-AICC-prefix WP retains canonical group provenance');
assert.equal(m8Record('AICC_REPOSITORY_STALE_TEST_DEBT_CLEANUP_V1').roadmapGroupNumber,'8.6');
assert.equal(m8Projection.records.some(record=>record.roadmapGroupNumber==='8.7'),false,'8.7 has no declared descendant WP in the current canonical Roadmap');
assert.equal(m8Record('AICC_GLOBAL_CANONICAL_LIFECYCLE_PROJECTION_V1').phasePlanAvailability,'NOT_AVAILABLE','no phase plan is explicit rather than fabricated');
assert.equal(m8Projection.model.entities.some(entity=>entity.identity.id==='8.4'||entity.identity.id==='M8.4'),false,'Roadmap grouping never becomes a Global State entity');
const m8Rows=projectGlobalWorkPackages(m8Snapshot,[],m8Projection);
const lifecycleRow=m8Rows.find(row=>row.workPackageId==='AICC_GLOBAL_CANONICAL_LIFECYCLE_PROJECTION_V1')!;
assert.equal(lifecycleRow.roadmap_group_number,'8.3','central WP row consumes Layer 2 grouping provenance');
assert.equal(lifecycleRow.roadmap_group_title,'Global Canonical Lifecycle Projection');
assert.equal(lifecycleRow.wp_lifecycle,lifecycleRow.status,'WP lifecycle is supplied by the same Layer 2 record');
assert.equal(lifecycleRow.wp_progress.state,'UNKNOWN','missing Roadmap progress remains unknown rather than inferred');
assert.equal(lifecycleRow.workPackageId,lifecycleRow.wp_id,'central row retains exact canonical WP identity');
const globalWpWorkspace=readFileSync(new URL('../components/GlobalWpWorkspace.svelte',import.meta.url),'utf8');
assert.doesNotMatch(globalWpWorkspace,/01_LIVING_ROADMAP|roadmapGroup(?:Number|Title)|8\.3|8\.4/,'WP UI does not parse or hardcode Roadmap grouping');
console.log('AICC Phase 4 WP canonical projection contract passed');
