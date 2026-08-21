import {execFileSync} from 'node:child_process';
import type {DeliveryContextRecord,DeliveryContextRecordStore} from './deliveryContextPersistence.ts';

export type ExistingDeliveryArtifact={repository:string;branch:string;worktreePath:string;commitSha:string;prNumber:number;prRepository:string;prUrl:string;prState:'CREATED'|'OPEN'|'UPDATED'|'READY_FOR_REVIEW';baseBranch:string;providerId:string;executionId?:string|null;workPackageId:string;discoveredAt?:string};
export type ImportedDeliveryArtifact={record:DeliveryContextRecord;executionBinding:{delivery_context_id:string;worktree_path:string;branch:string;execution_id:string|null};reused:boolean};

export function discoverExistingDeliveryArtifact(input:{repository:string;branch:string;worktreePath:string;prNumber:number;prRepository:string;prUrl:string;prState:ExistingDeliveryArtifact['prState'];baseBranch:string;providerId:string;workPackageId:string;executionId?:string|null;gitHead?:string}):ExistingDeliveryArtifact{
  const commitSha=input.gitHead??execFileSync('git',['-C',input.worktreePath,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
  return {...input,commitSha,discoveredAt:new Date().toISOString()};
}

export function importExistingDeliveryArtifact(artifact:ExistingDeliveryArtifact,store:DeliveryContextRecordStore):ImportedDeliveryArtifact{
  const existing=store.findByWorkPackage(artifact.workPackageId);
  if(existing){
    if(existing.repository!==artifact.repository||existing.delivery_branch!==artifact.branch||existing.commit_sha!==artifact.commitSha||existing.pr_number!==artifact.prNumber)throw new Error('DELIVERY_CONTEXT_IDENTITY_MISMATCH');
    return {record:existing,executionBinding:{delivery_context_id:existing.delivery_context_id,worktree_path:existing.worktree_path,branch:existing.delivery_branch,execution_id:existing.execution_id},reused:true};
  }
  const id=`delivery-${artifact.workPackageId.toLowerCase()}-${artifact.commitSha.slice(0,12)}`;
  const now=artifact.discoveredAt??new Date().toISOString();
  const record:DeliveryContextRecord={delivery_context_id:id,work_package_id:artifact.workPackageId,repository:artifact.repository,base_branch:artifact.baseBranch,delivery_branch:artifact.branch,worktree_path:artifact.worktreePath,commit_sha:artifact.commitSha,head_sha:artifact.commitSha,pr_number:artifact.prNumber,pr_repository:artifact.prRepository,pr_url:artifact.prUrl,pr_state:artifact.prState,pr_head_sha:artifact.commitSha,pr_base_branch:artifact.baseBranch,provider_id:artifact.providerId,execution_id:artifact.executionId??null,review_execution_id:null,review_provider_id:null,review_head_sha:null,review_status:null,review_result:null,ci_execution_id:null,ci_provider_id:null,ci_commit_sha:null,ci_head_sha:null,ci_status:null,ci_result:null,lifecycle_state:'PR_CREATED',created_at:now,updated_at:now};
  const persisted=store.create(record);
  return {record:persisted,executionBinding:{delivery_context_id:persisted.delivery_context_id,worktree_path:persisted.worktree_path,branch:persisted.delivery_branch,execution_id:persisted.execution_id},reused:persisted!==record};
}
