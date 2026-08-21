import type {ProjectRecord} from './projectRegistryAuthority.ts';

export type ProjectIdentityScope=Readonly<{projectId:string;repositoryIdentity:string}>;
export type ProjectEntityScope=ProjectIdentityScope&Readonly<{repositoryPath:string}>;
export type LegacyProjectEvidence=Readonly<{repositoryPath?:string|null;repositoryIdentity?:string|null;repository?:string|null}>;

export function projectIdentityScope(project:Pick<ProjectRecord,'projectId'|'repositoryIdentity'>):ProjectIdentityScope{return Object.freeze({projectId:project.projectId,repositoryIdentity:project.repositoryIdentity})}
export function projectEntityScope(project:ProjectRecord):ProjectEntityScope{return Object.freeze({...projectIdentityScope(project),repositoryPath:project.repositoryPath})}
export function scopedEntityKey(scope:Pick<ProjectEntityScope,'projectId'|'repositoryIdentity'>,kind:string,id:string):string{return `${scope.projectId}:${scope.repositoryIdentity}:${kind}:${id}`}
export function sameProjectScope(left:Pick<ProjectEntityScope,'projectId'|'repositoryIdentity'>,right:Pick<ProjectEntityScope,'projectId'|'repositoryIdentity'>):boolean{return left.projectId===right.projectId&&left.repositoryIdentity===right.repositoryIdentity}
/** Legacy records are mapped only when a stored repository fact exactly matches a registered Project. */
export function backfillProjectScope(evidence:LegacyProjectEvidence,projects:readonly ProjectRecord[]):ProjectEntityScope|null{
  const matches=projects.filter(project=>evidence.repositoryPath===project.repositoryPath||evidence.repositoryIdentity===project.repositoryIdentity||evidence.repository===project.repositoryIdentity);
  return matches.length===1?projectEntityScope(matches[0]):null;
}
export function belongsToProject<T extends Partial<ProjectEntityScope>>(record:T,scope:Pick<ProjectEntityScope,'projectId'|'repositoryIdentity'>):boolean{return record.projectId===scope.projectId&&record.repositoryIdentity===scope.repositoryIdentity}
