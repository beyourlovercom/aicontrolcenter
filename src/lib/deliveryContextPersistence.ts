import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';

export type DeliveryContextLifecycle='READY_FOR_EXECUTION'|'PR_CREATED'|'READY_FOR_UAT'|'CLOSED';

export type DeliveryContextRecord={
  delivery_context_id:string;
  work_package_id:string;
  repository:string;
  base_branch:string;
  delivery_branch:string;
  worktree_path:string;
  commit_sha:string;
  head_sha:string;
  pr_number:number|null;
  pr_repository:string|null;
  pr_url:string|null;
  pr_state:'CREATED'|'OPEN'|'UPDATED'|'READY_FOR_REVIEW'|null;
  pr_head_sha:string|null;
  pr_base_branch:string|null;
  provider_id:string;
  execution_id:string|null;
  review_execution_id:string|null;
  review_provider_id:string|null;
  review_head_sha:string|null;
  review_status:'PENDING'|'RUNNING'|'PASSED'|'FAILED'|'STALE'|null;
  review_result:string|null;
  ci_execution_id:string|null;
  ci_provider_id:string|null;
  ci_commit_sha:string|null;
  ci_head_sha:string|null;
  ci_status:'PENDING'|'RUNNING'|'PASSED'|'FAILED'|'STALE'|null;
  ci_result:unknown;
  lifecycle_state:DeliveryContextLifecycle;
  created_at:string;
  updated_at:string;
};

export interface DeliveryContextRecordStore{
  create(record:DeliveryContextRecord):DeliveryContextRecord;
  get(deliveryContextId:string):DeliveryContextRecord|null;
  update(deliveryContextId:string,patch:Partial<DeliveryContextRecord>):DeliveryContextRecord;
  findByWorkPackage(workPackageId:string):DeliveryContextRecord|null;
  findByPR(repository:string,prNumber:number):DeliveryContextRecord|null;
  findByHeadSHA(headSha:string):DeliveryContextRecord[];
}

export function createMemoryDeliveryContextRecordStore(initial:DeliveryContextRecord[]=[]):DeliveryContextRecordStore{
  const records=new Map(initial.map(record=>[record.delivery_context_id,{...record}]));
  return {
    create(record){
      const existing=records.get(record.delivery_context_id)??[...records.values()].find(item=>item.work_package_id===record.work_package_id&&item.repository===record.repository&&item.delivery_branch===record.delivery_branch);
      if(existing)return existing;
      records.set(record.delivery_context_id,{...record});return record;
    },
    get(id){return records.get(id)??null;},
    update(id,patch){const current=records.get(id);if(!current)throw new Error('DELIVERY_CONTEXT_NOT_FOUND');const next={...current,...patch,delivery_context_id:current.delivery_context_id,updated_at:patch.updated_at??new Date().toISOString()};records.set(id,next);return next;},
    findByWorkPackage(id){return [...records.values()].find(record=>record.work_package_id===id)??null;},
    findByPR(repository,number){return [...records.values()].find(record=>record.repository===repository&&record.pr_number===number)??null;},
    findByHeadSHA(sha){return [...records.values()].filter(record=>record.head_sha===sha);}
  };
}

export function createJsonDeliveryContextRecordStore(filePath:string):DeliveryContextRecordStore{
  const read=():DeliveryContextRecord[]=>{try{const value=JSON.parse(readFileSync(filePath,'utf8'));return Array.isArray(value)?value:[];}catch{return[];}};
  const write=(records:DeliveryContextRecord[])=>{mkdirSync(dirname(filePath),{recursive:true});writeFileSync(filePath,JSON.stringify(records,null,2),{mode:0o600});};
  const memory=createMemoryDeliveryContextRecordStore(read());
  return {
    create(record){const result=memory.create(record);write(memory.findByHeadSHA('').length?read().filter(item=>item.delivery_context_id!==result.delivery_context_id).concat(result):read().filter(item=>item.delivery_context_id!==result.delivery_context_id).concat(result));return result;},
    get(id){return memory.get(id);},
    update(id,patch){const result=memory.update(id,patch);write(read().filter(item=>item.delivery_context_id!==id).concat(result));return result;},
    findByWorkPackage(id){return memory.findByWorkPackage(id);},
    findByPR(repository,number){return memory.findByPR(repository,number);},
    findByHeadSHA(sha){return memory.findByHeadSHA(sha);}
  };
}

export function deliveryContextRecordFromGit(input:{deliveryContextId:string;workPackageId:string;repository:string;baseBranch:string;deliveryBranch:string;worktreePath:string;commitSha:string;prNumber?:number|null;providerId:string;executionId?:string|null;lifecycleState?:DeliveryContextLifecycle;now?:string}):DeliveryContextRecord{
  const now=input.now??new Date().toISOString();
  return {delivery_context_id:input.deliveryContextId,work_package_id:input.workPackageId,repository:input.repository,base_branch:input.baseBranch,delivery_branch:input.deliveryBranch,worktree_path:input.worktreePath,commit_sha:input.commitSha,head_sha:input.commitSha,pr_number:input.prNumber??null,pr_repository:null,pr_url:null,pr_state:null,pr_head_sha:null,pr_base_branch:null,provider_id:input.providerId,execution_id:input.executionId??null,review_execution_id:null,review_provider_id:null,review_head_sha:null,review_status:null,review_result:null,ci_execution_id:null,ci_provider_id:null,ci_commit_sha:null,ci_head_sha:null,ci_status:null,ci_result:null,lifecycle_state:input.lifecycleState??'READY_FOR_EXECUTION',created_at:now,updated_at:now};
}

export function bindPullRequest(record:DeliveryContextRecord,input:{prNumber:number;prRepository:string;prUrl:string;prState:'CREATED'|'OPEN'|'UPDATED'|'READY_FOR_REVIEW';prHeadSha:string;prBaseBranch:string;updatedAt?:string}):DeliveryContextRecord{
  if(input.prHeadSha!==record.head_sha)throw new Error('PR_HEAD_MISMATCH');
  return {...record,pr_number:input.prNumber,pr_repository:input.prRepository,pr_url:input.prUrl,pr_state:input.prState,pr_head_sha:input.prHeadSha,pr_base_branch:input.prBaseBranch,lifecycle_state:input.prState==='READY_FOR_REVIEW'?'READY_FOR_UAT':'PR_CREATED',updated_at:input.updatedAt??new Date().toISOString()};
}

export function findDeliveryContextByPR(store:DeliveryContextRecordStore,repository:string,prNumber:number):DeliveryContextRecord|null{return store.findByPR(repository,prNumber);}

export function bindReviewExecution(record:DeliveryContextRecord,input:{reviewExecutionId:string;providerId:string;repository:string;prNumber:number;headSha:string;status:'PENDING'|'RUNNING'|'PASSED'|'FAILED'|'STALE';result?:string|null;updatedAt?:string}):DeliveryContextRecord{
  if(input.repository!==record.pr_repository||input.prNumber!==record.pr_number)throw new Error('REVIEW_PR_MISMATCH');
  if(input.headSha!==record.head_sha||input.headSha!==record.pr_head_sha)throw new Error('REVIEW_HEAD_MISMATCH');
  return {...record,review_execution_id:input.reviewExecutionId,review_provider_id:input.providerId,review_head_sha:input.headSha,review_status:input.status,review_result:input.result??null,updated_at:input.updatedAt??new Date().toISOString()};
}

export function bindCiExecution(record:DeliveryContextRecord,input:{ciExecutionId:string;providerId:string;repository:string;prNumber:number;commitSha:string;headSha:string;status:'PENDING'|'RUNNING'|'PASSED'|'FAILED'|'STALE';result?:unknown;updatedAt?:string}):DeliveryContextRecord{
  if(input.repository!==record.pr_repository||input.prNumber!==record.pr_number)throw new Error('CI_PR_MISMATCH');
  if(input.commitSha!==record.commit_sha||input.headSha!==record.head_sha||input.headSha!==record.pr_head_sha)throw new Error('CI_HEAD_MISMATCH');
  return {...record,ci_execution_id:input.ciExecutionId,ci_provider_id:input.providerId,ci_commit_sha:input.commitSha,ci_head_sha:input.headSha,ci_status:input.status,ci_result:input.result??null,updated_at:input.updatedAt??new Date().toISOString()};
}
