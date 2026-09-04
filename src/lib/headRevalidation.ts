import {createAutomaticCiExecution,type CiRequestStore} from './automaticCi.ts';
import {createAutomaticReviewExecution,type ReviewRequestStore} from './automaticReview.ts';
import {projectExactHeadValidation,type CiEvidence, type ReviewEvidence} from './exactHeadEvidence.ts';
export type HeadChangeEvent={head_change_event_id:string;delivery_context_id:string;old_head_sha:string;new_head_sha:string;repository:string;pr_number:number;created_at:string};
export type HeadRevalidationStore={events:HeadChangeEvent[];reviews:ReviewRequestStore;cI:CiRequestStore};
let sequence=0;
export function reconcileDeliveryHead(input:{deliveryContextId:string;repository:string;prNumber?:number|null;previousHeadSha?:string|null;currentHeadSha?:string|null;reviewProvider:string;ciProvider:string},store:HeadRevalidationStore){
  if(!input.prNumber||!input.previousHeadSha||!input.currentHeadSha||input.previousHeadSha===input.currentHeadSha)return null;
  const existing=store.events.find(event=>event.delivery_context_id===input.deliveryContextId&&event.new_head_sha===input.currentHeadSha);if(existing)return existing;
  const event={head_change_event_id:`head-change-${Date.now()}-${++sequence}`,delivery_context_id:input.deliveryContextId,old_head_sha:input.previousHeadSha,new_head_sha:input.currentHeadSha,repository:input.repository,pr_number:input.prNumber,created_at:new Date().toISOString()};store.events.push(event);
  createAutomaticReviewExecution({deliveryContextId:input.deliveryContextId,repository:input.repository,prNumber:input.prNumber,headSha:input.currentHeadSha,provider:input.reviewProvider,status:'READY_FOR_REVIEW'},store.reviews);
  return event;
}
export function continueAfterReview(event:HeadChangeEvent,reviewStatus:'COMPLETED'|'FAILED',store:HeadRevalidationStore){
  if(reviewStatus!=='COMPLETED')return null;
  return createAutomaticCiExecution({deliveryContextId:event.delivery_context_id,repository:event.repository,prNumber:event.pr_number,headSha:event.new_head_sha,provider:'actions',status:'READY_FOR_CI'},store.cI);
}
export function projectHeadRevalidation(event:HeadChangeEvent|null,reviews:ReviewEvidence[]=[],ci:CiEvidence[]=[]){if(!event)return null;return projectExactHeadValidation({repository:event.repository,pr_number:event.pr_number,head_sha:event.new_head_sha},reviews,ci);}
