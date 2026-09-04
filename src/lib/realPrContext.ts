import {projectExactHeadValidation,type CiEvidence,type ReviewEvidence} from './exactHeadEvidence.ts';
import type {DeliveryContext} from './deliveryWorkspace.ts';

export type CommitEvidence={sha:string;repository:string;branch:string;delivery_context_id:string;captured_at:string};
export type RealPrState='CREATED'|'OPEN'|'UPDATED'|'READY_FOR_REVIEW';
export type RealPrContext={pr_context_id:string;delivery_context_id:string;repository:string;pr_number:number|null;head_sha:string;base_branch:string;state:RealPrState;commit:CommitEvidence;created_at:string;updated_at:string};
export type RealPrContextStore={get(deliveryContextId:string):RealPrContext|null;put(context:RealPrContext):void};

export function createRealPrContext(delivery:DeliveryContext,commit:{sha:string;capturedAt?:string},store:RealPrContextStore,now=new Date().toISOString()):RealPrContext{
  const existing=store.get(delivery.deliveryContextId);if(existing)return existing;
  const evidence:CommitEvidence={sha:commit.sha,repository:delivery.repository,branch:delivery.deliveryBranch,delivery_context_id:delivery.deliveryContextId,captured_at:commit.capturedAt??now};
  const context:RealPrContext={pr_context_id:`pr-context-${delivery.deliveryContextId}`,delivery_context_id:delivery.deliveryContextId,repository:delivery.repository,pr_number:null,head_sha:commit.sha,base_branch:delivery.baseBranch,state:'CREATED',commit:evidence,created_at:now,updated_at:now};store.put(context);return context;
}
export function transitionRealPrState(context:RealPrContext,state:RealPrState,now=new Date().toISOString()):RealPrContext{if(context.state===state)return context;context.state=state;context.updated_at=now;return context;}
export function updateRealPrHead(context:RealPrContext,sha:string,now=new Date().toISOString()):RealPrContext{context.head_sha=sha;context.state='UPDATED';context.updated_at=now;return context;}
export function projectRealPrHead(context:RealPrContext,reviews:ReviewEvidence[]=[],ci:CiEvidence[]=[]){return projectExactHeadValidation({repository:context.repository,pr_number:context.pr_number??0,head_sha:context.head_sha},reviews,ci);}
