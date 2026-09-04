import {join} from 'node:path';
import {createEmptyGlobalStateReadModel,type AiccGlobalStateReadModel} from './globalStateReadModel.ts';
import {deserializeRoadmapProjection,type RoadmapProjection} from './roadmapProjection.ts';
import {ensureRoadmapReadModel,type AiccRoadmapReadModel} from './roadmapReadModel.ts';
import {createProjectRegistryAuthority,type ProjectRecord} from './projectRegistryAuthority.ts';
import {projectEntityScope} from './projectEntityScope.ts';

export const ROADMAP_PROJECT_AUTHORITY='ACTIVE_PROJECT_ROADMAP_READ_MODEL_V1' as const;
export const ROADMAP_NOT_CONFIGURED='NOT_CONFIGURED' as const;
export type ProjectScopedRoadmapProjection=Readonly<{authority:typeof ROADMAP_PROJECT_AUTHORITY;projectId:string;repositoryIdentity:string;projectContextRevision:number;roadmapPath:string;availability:'AVAILABLE'|'NOT_CONFIGURED';projection:AiccRoadmapReadModel|null}>;

function scopedReadModelPath(project:ProjectRecord):string{return project.projectId==='aicc'?join(project.repositoryPath,'docs/10_Planning_Roadmap/02_AICC_ROADMAP_READ_MODEL.json'):join(project.repositoryPath,'docs/10_Planning_Roadmap',`02_AICC_ROADMAP_READ_MODEL.${project.projectId}.json`)}
function read(forceRebuild=false,registryFile?:string):ProjectScopedRoadmapProjection{
  const authority=createProjectRegistryAuthority(registryFile),registry=authority.getProjectRegistry(),project=authority.getActiveProject(),scope=projectEntityScope(project);
  if(project.roadmapPath===ROADMAP_NOT_CONFIGURED)return Object.freeze({authority:ROADMAP_PROJECT_AUTHORITY,...scope,projectContextRevision:registry.projectContextRevision,roadmapPath:ROADMAP_NOT_CONFIGURED,availability:'NOT_CONFIGURED',projection:null});
  const projection=ensureRoadmapReadModel({repositoryRoot:project.repositoryPath,sourcePath:join(project.repositoryPath,project.roadmapPath),readModelPath:scopedReadModelPath(project),forceRebuild});
  return Object.freeze({authority:ROADMAP_PROJECT_AUTHORITY,...scope,projectContextRevision:registry.projectContextRevision,roadmapPath:project.roadmapPath,availability:'AVAILABLE',projection});
}
/** The registry is the only active-project authority; unavailable is structural, never a fallback. */
export const readActiveProjectRoadmap=(registryFile?:string)=>read(false,registryFile);
export const syncActiveProjectRoadmap=(registryFile?:string)=>read(true,registryFile);
export function projectScopedRoadmapNodes(model:ProjectScopedRoadmapProjection):RoadmapProjection|null{return model.projection?deserializeRoadmapProjection(model.projection):null}
/** A new project context has no right to retain prior-project Layer 2 entities or bindings. */
export function bindGlobalStateToActiveProject(previous:AiccGlobalStateReadModel,model:ProjectScopedRoadmapProjection):AiccGlobalStateReadModel{return previous.projectId===model.projectId&&previous.repositoryIdentity===model.repositoryIdentity&&previous.projectContextRevision===model.projectContextRevision?previous:createEmptyGlobalStateReadModel({projectId:model.projectId,repositoryIdentity:model.repositoryIdentity,projectContextRevision:model.projectContextRevision})}
