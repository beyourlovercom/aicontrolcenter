import type {AiccProjectSnapshot,ResolvedAuthorization,SelectedEntityRef} from '../model/entityTypes.ts';

export function resolveAuthorizationForEntity(selected:SelectedEntityRef,snapshot:AiccProjectSnapshot):ResolvedAuthorization{
  if(selected.type!=='work_package')return {state:'NONE',record:null};
  if(snapshot.authorizations.availability==='UNAVAILABLE')return {state:'UNAVAILABLE',record:null,reasonCode:snapshot.authorizations.errorCode};
  const records=snapshot.authorizations.value??[];
  const record=records.find(candidate=>candidate.workPackageId===selected.id)??null;
  if(!record)return {state:'NONE',record:null};
  const repo=snapshot.repository.value;
  if(!repo)return {state:'UNAVAILABLE',record:null,reasonCode:snapshot.repository.errorCode};
  if(record.repositoryRoot!==repo.repository)return {state:'CONTEXT_MISMATCH',record:null,reasonCode:'AUTHORIZATION_REPOSITORY_MISMATCH'};
  if(record.branch!==repo.branch)return {state:'STALE_BRANCH',record,reasonCode:'AUTHORIZATION_BRANCH_MISMATCH'};
  if(record.authoritySha!==repo.remoteMain)return {state:'CONFLICT',record,reasonCode:'AUTHORITY_DRIFT'};
  // Execution validity is decided by the server-side Fast Execution lease
  // preflight. The browser read model must not reintroduce an exact-HEAD gate.
  return {state:'VALID',record};
}
