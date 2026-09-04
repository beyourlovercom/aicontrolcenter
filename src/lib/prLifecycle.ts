import {projectExactHeadValidation,type CiEvidence,type ReviewEvidence} from './exactHeadEvidence.ts';
export type PrLifecycleState='DRAFT'|'IMPLEMENTATION'|'REVIEW_RUNNING'|'REVIEW_COMPLETE'|'CI_RUNNING'|'CI_COMPLETE'|'REMEDIATION_RUNNING'|'REVALIDATING'|'READY_FOR_OWNER_UAT'|'BLOCKED';
export type PrLifecycleEntry={state:PrLifecycleState;entered_at:string;source_event:string;delivery_context_id:string};
export type PrLifecycleStore={history:PrLifecycleEntry[]};
const allowed:Record<PrLifecycleState,PrLifecycleState[]>={DRAFT:['REVIEW_RUNNING'],IMPLEMENTATION:['DRAFT'],REVIEW_RUNNING:['REVIEW_COMPLETE','BLOCKED'],REVIEW_COMPLETE:['CI_RUNNING'],CI_RUNNING:['CI_COMPLETE','BLOCKED'],CI_COMPLETE:['REMEDIATION_RUNNING','READY_FOR_OWNER_UAT'],REMEDIATION_RUNNING:['REVALIDATING','BLOCKED'],REVALIDATING:['REVIEW_RUNNING','READY_FOR_OWNER_UAT'],READY_FOR_OWNER_UAT:[],BLOCKED:['REMEDIATION_RUNNING'],};
export function transitionPrLifecycle(store:PrLifecycleStore,input:{state:PrLifecycleState;sourceEvent:string;deliveryContextId:string}):PrLifecycleEntry|null{
  const current=store.history.at(-1);if(current?.state===input.state&&current.source_event===input.sourceEvent)return current;if(current&&!allowed[current.state].includes(input.state))return null;
  const entry={state:input.state,entered_at:new Date().toISOString(),source_event:input.sourceEvent,delivery_context_id:input.deliveryContextId};store.history.push(entry);return entry;
}
export function readyForOwnerUat(input:{repository:string;prNumber:number;currentHead:string;reviews:ReviewEvidence[];ci:CiEvidence[];reviewStatus:ReviewEvidence['review_status'];ciConclusion:string}):boolean{
  const validation=projectExactHeadValidation({repository:input.repository,pr_number:input.prNumber,head_sha:input.currentHead},input.reviews,input.ci);
  return input.reviewStatus==='PASS'&&input.ciConclusion==='SUCCESS'&&validation.review.current_for_head&&validation.ci.current_for_head;
}
export function currentPrLifecycle(store:PrLifecycleStore){return store.history.at(-1)?.state??'IMPLEMENTATION';}
