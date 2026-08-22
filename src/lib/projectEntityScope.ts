import type {ProjectRecord} from './projectRegistryAuthority.ts';

export type ProjectIdentityScope=Readonly<{projectId:string;repositoryIdentity:string}>;
export type ProjectEntityScope=ProjectIdentityScope&Readonly<{repositoryPath:string}>;
export type LegacyProjectEvidence=Readonly<{repositoryPath?:string|null;repositoryIdentity?:string|null;repository?:string|null}>;

export function projectIdentityScope(project:Pick<ProjectRecord,'projectId'|'repositoryIdentity'>):ProjectIdentityScope{return Object.freeze({projectId:project.projectId,repositoryIdentity:project.repositoryIdentity})}
export function projectEntityScope(project:ProjectRecord):ProjectEntityScope{return Object.freeze({...projectIdentityScope(project),repositoryPath:project.repositoryPath})}
export function scopedEntityKey(scope:Pick<ProjectEntityScope,'projectId'|'repositoryIdentity'>,kind:string,id:string):string{return `${scope.projectId}:${scope.repositoryIdentity}:${kind}:${id}`}
export function sameProjectScope(left:Pick<ProjectEntityScope,'projectId'|'repositoryIdentity'>,right:Pick<ProjectEntityScope,'projectId'|'repositoryIdentity'>):boolean{return left.projectId===right.projectId&&left.repositoryIdentity===right.repositoryIdentity}
/** Legacy path-only evidence may bind only through Project Registry aliases already validated by the server authority. */
export function backfillProjectScope(evidence:LegacyProjectEvidence,projects:readonly ProjectRecord[]):ProjectEntityScope|null{
  const matches=projects.filter(project=>{const registeredPathAliases=[project.repositoryPath,project.canonicalRepositoryPath].filter((value):value is string=>Boolean(value));return evidence.repositoryIdentity===project.repositoryIdentity||evidence.repository===project.repositoryIdentity||Boolean(evidence.repositoryPath&&registeredPathAliases.includes(evidence.repositoryPath));});
  return matches.length===1?projectEntityScope(matches[0]):null;
}
export function belongsToProject<T extends Partial<ProjectEntityScope>>(record:T,scope:Pick<ProjectEntityScope,'projectId'|'repositoryIdentity'>):boolean{return record.projectId===scope.projectId&&record.repositoryIdentity===scope.repositoryIdentity}
