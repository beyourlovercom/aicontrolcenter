import type {PullRequestEntityContext} from '../model/entityTypes.ts';

export const prTabIds=['运行','UAT','概览','证据','Diff','Review','CI','Merge'] as const;
export type PrTabId=typeof prTabIds[number];
export type PrTabView={tab:PrTabId;title:string;rows:Array<[string,string]>;description?:string};
const value=(value:string|number|undefined|null,empty='NOT_BOUND')=>value===undefined||value===null||value===''?empty:String(value);
const presentation=(value:string|number|undefined|null,empty='未绑定')=>value===undefined||value===null||value===''?empty:String(value).replace(/^NOT_BOUND$/,'未绑定').replace(/^NOT_RUN$/,'未运行').replace(/^NOT_AVAILABLE$/,'未证明').replace(/^ABSENT$/,'无记录');

export function resolvePrTabView(context:PullRequestEntityContext,activeTab:string):PrTabView{
  const tab=(prTabIds.includes(activeTab as PrTabId)?activeTab:'概览') as PrTabId;
  const record=context.record;
  const fixture=record?.fixture===true;
  const common:[string,string][]=[['PR identity',record?.number?`PR #${record.number}`:context.id],['Title',presentation(record?.title,'未证明')],['Source',fixture?'LOCAL FIXTURE':record?.correlationSource??'EXTERNAL_FACT'],['Parent WP',presentation(context.parentWorkPackageId)],['Status',record?.state??context.statusLabel]];
  if(tab==='运行')return {tab,title:'PR 运行',description:'PR Runtime workspace 使用现有执行监控与运行结果投影。',rows:[['Runtime','NOT_STARTED / NOT_BOUND'],['Execution output','NOT_AVAILABLE']]};
  if(tab==='UAT')return {tab,title:'PR 人工 UAT',description:'仅展示当前 PR 可解析的真实 Human UAT 记录，不创建伪造记录。',rows:[['UAT status','NOT_STARTED'],['Pending verification','NOT_AVAILABLE'],['Owner feedback','NOT_RECORDED']]};
  if(tab==='概览')return {tab,title:'PR 概览',rows:[...common,['Repository',presentation(record?.repository,'未证明')],['Source branch',presentation(record?.sourceBranch,'无记录')],['Delivery branch',presentation(record?.deliveryBranch)],['PR HEAD',presentation(record?.headSha)],['Latest commit',presentation(record?.latestCommit)],['Mergeability',presentation(record?.mergeability,'未运行')],['Merge result',presentation(record?.mergeResult,'未运行')],['Lifecycle Status',context.lifecycleWorkspace.lifecycleStatus]]};
  if(tab==='Diff')return {tab,title:'Diff',rows:[['Source',fixture?'DEMO · LOCAL FIXTURE':'PRODUCTION'],['Production PR',fixture?'ABSENT':'UNAVAILABLE'],['Files changed',value(record?.filesChanged, '0')],['Diff','NOT_BOUND / ABSENT']]};
  if(tab==='Review'){
    const review=context.exactHeadValidation?.review;
    const status=review?.status??'NOT_AVAILABLE';
    const headState=review?.current_for_head?'CURRENT_FOR_HEAD':review?.historical?'HISTORICAL_FOR_OLDER_HEAD':'NOT_AVAILABLE';
    return {tab,title:'Review',description:'Review evidence is current only when its repository, PR number, and head SHA match the canonical PR fact.',rows:[['Review',status],['Current PR Head',value(context.record?.headSha)],['Reviewer',value(review?.reviewer)],['Provider',value(review?.review_provider)],['Review Status',status],['Reviewed Head',value(review?.evidence_head_sha)],['Current for Head',review?.current_for_head?'YES':'NO'],['Reviewed At',value(review?.reviewed_at)],['Head match',headState]]};
  }
  if(tab==='CI'){
    const ci=context.exactHeadValidation?.ci;
    const status=ci?.status??'NOT_AVAILABLE';
    const headState=ci?.current_for_head?'CURRENT_FOR_HEAD':ci?.historical?'HISTORICAL_FOR_OLDER_HEAD':'NOT_AVAILABLE';
    return {tab,title:'Exact-head CI',description:'CI evidence is current only when its repository, PR number, and head SHA match the canonical PR fact.',rows:[['Exact-head CI',status],['Conclusion',ci?.conclusion??'NOT_AVAILABLE'],['Evidence head',value(ci?.evidence_head_sha)],['Head match',headState]]};
  }
  if(tab==='Merge')return {tab,title:'Merge',rows:[['Mergeability','NOT_RUN'],['Ready to Merge','NOT_RUN'],['Merge Result','NOT_RUN'],['Merge SHA','ABSENT']]};
  return {tab,title:'PR 证据',description:'M4 仅展示已有 PR 事实，不提供 Review、CI 或 Merge 权威。',rows:[['Source',fixture?'LOCAL FIXTURE':record?.correlationSource??'EXTERNAL_FACT'],['Parent WP',value(context.parentWorkPackageId)],['PR URL',value(record?.url)],['PR HEAD',value(record?.headSha)],['CI','INFORMATION_ONLY / NOT_M4_AUTHORITY'],['Review','INFORMATION_ONLY / NOT_M4_AUTHORITY'],['Merge','INFORMATION_ONLY / NOT_M4_AUTHORITY']]};
}
