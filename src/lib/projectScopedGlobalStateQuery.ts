import {backfillProjectScope,belongsToProject,projectEntityScope,type ProjectEntityScope} from './projectEntityScope.ts';
import type {ProjectRecord} from './projectRegistryAuthority.ts';

export const GLOBAL_STATE_PROJECT_QUERY_AUTHORITY='PROJECT_SCOPED_CANONICAL_READ_MODEL_QUERY_V1' as const;

/** The only Layer 2 entrypoint that admits project-sensitive entity records. */
export function queryProjectScopedEntities<T extends Record<string,any>>(scope:Pick<ProjectEntityScope,'projectId'|'repositoryIdentity'>,records:readonly T[],projects:readonly ProjectRecord[]):T[]{
  return records.map(record=>{
    const binding=record.projectId&&record.repositoryIdentity?{projectId:record.projectId,repositoryIdentity:record.repositoryIdentity,repositoryPath:record.repositoryPath??''}:backfillProjectScope({repositoryPath:record.repositoryPath,repositoryIdentity:record.repositoryIdentity,repository:record.repository},projects);
    return binding?{...record,...binding}:record;
  }).filter(record=>belongsToProject(record,scope));
}
