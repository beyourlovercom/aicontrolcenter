export type ExactHeadIdentity={repository:string;pr_number:number;head_sha:string};
export type ReviewStatus='PASS'|'FAIL'|'BLOCKED'|'ERROR'|'PENDING';
export type ReviewEvidence={review_id:string;repository:string;pr_number:number;head_sha:string;reviewer:string;review_provider:string;review_status:ReviewStatus;review_summary:string;reviewed_at:string};
export type CiEvidence={ci_run_id:string;repository:string;pr_number:number;head_sha:string;provider:string;workflow:string;status:string;conclusion:string;started_at:string;completed_at?:string;url?:string};
export type ReviewProjection={evidence_head_sha:string|null;status:ReviewStatus|'NOT_AVAILABLE'|'STALE_FOR_CURRENT_HEAD';current_for_head:boolean;historical:boolean;review_id?:string;reviewer?:string;review_provider?:string;review_summary?:string;reviewed_at?:string;history:ReviewEvidence[]};
export type CiProjection={evidence_head_sha:string|null;status:string|'STALE_FOR_CURRENT_HEAD';conclusion:string;current_for_head:boolean;historical:boolean;history:CiEvidence[]};
export type ExactHeadValidation={repository:string;pr_number:number;current_head_sha:string;review:ReviewProjection;ci:CiProjection};
export const exactHeadKey=(identity:ExactHeadIdentity):string=>`${identity.repository}#${identity.pr_number}@${identity.head_sha}`;
export const isExactHead=(currentHeadSha:string,evidenceHeadSha:string|undefined|null):boolean=>Boolean(evidenceHeadSha)&&currentHeadSha===evidenceHeadSha;
export function isCurrentEvidence(identity:ExactHeadIdentity,evidence:{repository:string;pr_number:number;head_sha:string}):boolean{return evidence.repository===identity.repository&&evidence.pr_number===identity.pr_number&&isExactHead(identity.head_sha,evidence.head_sha);}
export const reviewIdentityKey=(review:Pick<ReviewEvidence,'repository'|'pr_number'|'head_sha'|'reviewer'|'review_provider'>):string=>`${review.repository}#${review.pr_number}@${review.head_sha}:${review.reviewer}:${review.review_provider}`;
export const ciEvidenceKey=(evidence:Pick<CiEvidence,'repository'|'pr_number'|'head_sha'|'ci_run_id'>):string=>`${evidence.repository}#${evidence.pr_number}@${evidence.head_sha}:${evidence.ci_run_id}`;
/** Preserve distinct provider runs/workflows while removing duplicate observations. */
export function dedupeCiEvidence(items:CiEvidence[]):CiEvidence[]{
 const seen=new Set<string>();
 return items.filter(item=>{const key=ciEvidenceKey(item);if(seen.has(key))return false;seen.add(key);return true;});
}
/** Append a provider observation without duplicating the canonical identity. */
export function persistReviewEvidence(existing:ReviewEvidence[], evidence:ReviewEvidence):ReviewEvidence[]{
  const key=reviewIdentityKey(evidence);
  if(existing.some(item=>reviewIdentityKey(item)===key))return existing;
  return [...existing,evidence];
}
export type CanonicalReviewProvider=(request:ExactHeadIdentity)=>Promise<Omit<ReviewEvidence,'repository'|'pr_number'|'head_sha'>>;
/** Resolve the canonical PR fact before invocation and bind the returned result to that reviewed head. */
export async function invokeCanonicalReview(identity:ExactHeadIdentity,provider:CanonicalReviewProvider,existing:ReviewEvidence[]=[]):Promise<ReviewEvidence[]>{
  const result=await provider(identity);
  return persistReviewEvidence(existing,{...result,repository:identity.repository,pr_number:identity.pr_number,head_sha:identity.head_sha});
}
export function projectExactHeadValidation(identity:ExactHeadIdentity,reviews:ReviewEvidence[]=[],ciRuns:CiEvidence[]=[]):ExactHeadValidation{
 const history=reviews.filter(item=>item.repository===identity.repository&&item.pr_number===identity.pr_number);
 const ciHistory=ciRuns.filter(item=>item.repository===identity.repository&&item.pr_number===identity.pr_number);
 const review=history.find(item=>item.head_sha===identity.head_sha)??history[history.length-1];
 const ci=ciHistory.find(item=>isCurrentEvidence(identity,item))??ciHistory[ciHistory.length-1];
 const reviewCurrent=Boolean(review&&isCurrentEvidence(identity,review));
 const ciCurrent=Boolean(ci&&isCurrentEvidence(identity,ci));
 return {repository:identity.repository,pr_number:identity.pr_number,current_head_sha:identity.head_sha,review:{evidence_head_sha:review?.head_sha??null,status:review?(reviewCurrent?review.review_status:'STALE_FOR_CURRENT_HEAD'):'NOT_AVAILABLE',current_for_head:reviewCurrent,historical:Boolean(review),review_id:review?.review_id,reviewer:review?.reviewer,review_provider:review?.review_provider,review_summary:review?.review_summary,reviewed_at:review?.reviewed_at,history},ci:{evidence_head_sha:ci?.head_sha??null,status:ci?(ciCurrent?ci.status:'STALE_FOR_CURRENT_HEAD'):'NOT_AVAILABLE',conclusion:ci?.conclusion??'NOT_AVAILABLE',current_for_head:ciCurrent,historical:Boolean(ci),history:ciHistory}};
}
