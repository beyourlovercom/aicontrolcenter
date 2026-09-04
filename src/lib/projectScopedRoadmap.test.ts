import assert from 'node:assert/strict';
import {cpSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createEmptyGlobalStateReadModel,dimensionProjection,entityIdentity,knownDimensionValue,projectGlobalStateReadModel,projectionSource,sourceEntityIdentity} from './globalStateReadModel.ts';
import {createProjectRegistryAuthority} from './projectRegistryAuthority.ts';
import {bindGlobalStateToActiveProject,ROADMAP_NOT_CONFIGURED,projectScopedRoadmapNodes,readActiveProjectRoadmap,syncActiveProjectRoadmap} from './projectScopedRoadmap.ts';
import {readActiveProjectRepository} from './controlService.ts';

const directory=mkdtempSync(join(tmpdir(),'aicc-project-roadmap-'));
const registryFile=join(directory,'04_AICC_PROJECT_REGISTRY.json');
cpSync(join(process.cwd(),'docs/10_Planning_Roadmap/04_AICC_PROJECT_REGISTRY.json'),registryFile);
const aiccRepository=realpathSync(mkdtempSync(join(tmpdir(),'aicc-project-roadmap-aicc-')));
const erpRepository=realpathSync(mkdtempSync(join(tmpdir(),'aicc-project-roadmap-erp-')));
for(const [repository,origin] of [[aiccRepository,'git@github.com:beyourlovercom/aicontrolcenter.git'],[erpRepository,'git@github.com:beyourlovercom/erpbeyourlovercom.git']] as const){execFileSync('git',['-C',repository,'init','-b','fixture-branch'],{stdio:'ignore'});execFileSync('git',['-C',repository,'remote','add','origin',origin],{stdio:'ignore'});}
const roadmapDir=join(aiccRepository,'docs/10_Planning_Roadmap');mkdirSync(roadmapDir,{recursive:true});cpSync(join(process.cwd(),'docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md'),join(roadmapDir,'01_LIVING_ROADMAP.md'));
const registryFixture=JSON.parse(readFileSync(registryFile,'utf8'));
registryFixture.projects=registryFixture.projects.map((project:any)=>project.projectId==='aicc'?{...project,repositoryPath:aiccRepository,currentBranch:'fixture-branch'}:project.projectId==='erpbeyourlovercom'?{...project,repositoryPath:erpRepository,currentBranch:'fixture-branch'}:project);
writeFileSync(registryFile,JSON.stringify(registryFixture,null,2)+'\n');
try{
  const aicc=readActiveProjectRoadmap(registryFile);
  assert.equal(aicc.projectId,'aicc');assert.equal(aicc.availability,'AVAILABLE');assert.equal(aicc.roadmapPath,'docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md');assert.ok(projectScopedRoadmapNodes(aicc)?.nodes.length);
  const registry=createProjectRegistryAuthority(registryFile);registry.setActiveProject('erpbeyourlovercom');
  const erpRepositoryProjection=readActiveProjectRepository(registryFile);assert.equal(erpRepositoryProjection.repository,erpRepository);assert.equal(erpRepositoryProjection.branch,'fixture-branch','active repository projection follows Project Registry instead of AICC REPOSITORY_ROOT');
  const erp=readActiveProjectRoadmap(registryFile);assert.equal(erp.projectId,'erpbeyourlovercom');assert.equal(erp.roadmapPath,ROADMAP_NOT_CONFIGURED);assert.equal(erp.availability,'NOT_CONFIGURED');assert.equal(erp.projection,null);assert.equal(projectScopedRoadmapNodes(erp),null);
  const withAiccEntity=projectGlobalStateReadModel(createEmptyGlobalStateReadModel(aicc),{entities:[{identity:entityIdentity(aicc,'MILESTONE','M1'),dimensions:[dimensionProjection('milestone.lifecycle',knownDimensionValue('milestone.lifecycle','ACTIVE'),projectionSource(sourceEntityIdentity(aicc,'ROADMAP','aicc')))]}],bindings:[]});
  const erpState=bindGlobalStateToActiveProject(withAiccEntity,erp);assert.equal(erpState.projectId,'erpbeyourlovercom');assert.equal(erpState.projectContextRevision,1);assert.equal(erpState.entities.length,0);
  registry.setActiveProject('aicc');const aiccRepositoryProjection=readActiveProjectRepository(registryFile);assert.equal(aiccRepositoryProjection.repository,aiccRepository);assert.equal(aiccRepositoryProjection.branch,'fixture-branch');const restored=syncActiveProjectRoadmap(registryFile);assert.equal(restored.projectId,'aicc');assert.ok(projectScopedRoadmapNodes(restored)?.nodes.length);const aiccState=bindGlobalStateToActiveProject(erpState,restored);assert.equal(aiccState.projectId,'aicc');assert.equal(aiccState.projectContextRevision,2);assert.equal(aiccState.entities.length,0);
  const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
  assert.match(app,/availability==='NOT_CONFIGURED'[\s\S]*acceptRoadmapNotConfigured/,'UI accepts an explicit project Roadmap structural state');
  assert.match(app,/function bindActiveRoadmapProject[\s\S]*unlockExecutionContext[\s\S]*collapsedNodeIds=new Set[\s\S]*taskRecords=\[\][\s\S]*runtimeHistory=\[\]/,'project switches clear Roadmap, Task, and Run projections from the browser');
  assert.match(app,/await loadAcceptedRoadmapProjection\(\);\s*if\(activeRoadmapProject\?\.projectId!=='aicc'\)return/,'ERP structural state does not request AICC-only snapshot sources');
  assert.doesNotMatch(app,/compileRoadmapProjection|normalizeRoadmap/,'UI does not parse project Markdown');
  const vite=readFileSync(new URL('../../vite.config.ts',import.meta.url),'utf8');assert.match(vite,/\/api\/repository[\s\S]*readActiveProjectRepository/,'browser repository endpoint follows the active Project Registry authority');
  console.log('Phase 2 project-scoped Roadmap and Global State matrix passed');
}finally{rmSync(directory,{recursive:true,force:true});rmSync(aiccRepository,{recursive:true,force:true});rmSync(erpRepository,{recursive:true,force:true})}
