import type {PullRequestEntityContext} from '../model/entityTypes.ts';

export const prTabIds=['运行','UAT','概览','证据','Diff','Review','CI','Merge'] as const;
export type PrTabId=typeof prTabIds[number];
export type PrTabView={tab:PrTabId;title:string;rows:Array<[string,string]>;description?:string};
const value=(value:string|number|undefined|null,empty='NOT_BOUND')=>value===undefined||value===null||value===''?empty:String(value);

export function resolvePrTabView(context:PullRequestEntityContext,activeTab:string):PrTabView{
  const tab=(prTabIds.includes(activeTab as PrTabId)?activeTab:'概览') as PrTabId;
  const record=context.record;
  const fixture=record?.fixture===true;
  const common:[string,string][]=[['PR identity',record?.number?`PR #${record.number}`:context.id],['Title',record?.title??'NOT_BOUND'],['Source',fixture?'LOCAL FIXTURE':record?.correlationSource??'EXTERNAL_FACT'],['Parent WP',value(context.parentWorkPackageId)],['Status',record?.state??context.statusLabel]];
  if(tab==='运行')return {tab,title:'PR 运行',description:'PR Runtime workspace 使用现有执行监控与运行结果投影。',rows:[['Runtime','NOT_STARTED / NOT_BOUND'],['Execution output','NOT_AVAILABLE']]};
  if(tab==='UAT')return {tab,title:'PR 人工 UAT',description:'仅展示当前 PR 可解析的真实 Human UAT 记录，不创建伪造记录。',rows:[['UAT status','NOT_STARTED'],['Pending verification','NOT_AVAILABLE'],['Owner feedback','NOT_RECORDED']]};
  if(tab==='概览')return {tab,title:'PR 概览',rows:[...common,['Repository',value(record?.repository)],['Source branch',value(record?.sourceBranch,'ABSENT')],['Delivery branch',value(record?.deliveryBranch,'NOT_BOUND')],['PR HEAD',value(record?.headSha)],['Latest commit',value(record?.latestCommit)],['Mergeability',value(record?.mergeability,'NOT_RUN')],['Merge result',value(record?.mergeResult,'NOT_RUN')]]};
  if(tab==='Diff')return {tab,title:'Diff',rows:[['Source',fixture?'DEMO · LOCAL FIXTURE':'PRODUCTION'],['Production PR',fixture?'ABSENT':'UNAVAILABLE'],['Files changed',value(record?.filesChanged, '0')],['Diff','NOT_BOUND / ABSENT']]};
  if(tab==='Review')return {tab,title:'Review',rows:[['Review','NOT_RUN'],['Reviewer','NOT_BOUND'],['Review evidence','ABSENT']]};
  if(tab==='CI')return {tab,title:'Exact-head CI',rows:[['Exact-head CI','NOT_RUN'],['CI provider','NOT_BOUND'],['CI run','ABSENT']]};
  if(tab==='Merge')return {tab,title:'Merge',rows:[['Mergeability','NOT_RUN'],['Ready to Merge','NOT_RUN'],['Merge Result','NOT_RUN'],['Merge SHA','ABSENT']]};
  return {tab,title:'PR 证据',description:'M4 仅展示已有 PR 事实，不提供 Review、CI 或 Merge 权威。',rows:[['Source',fixture?'LOCAL FIXTURE':record?.correlationSource??'EXTERNAL_FACT'],['Parent WP',value(context.parentWorkPackageId)],['PR URL',value(record?.url)],['PR HEAD',value(record?.headSha)],['CI','INFORMATION_ONLY / NOT_M4_AUTHORITY'],['Review','INFORMATION_ONLY / NOT_M4_AUTHORITY'],['Merge','INFORMATION_ONLY / NOT_M4_AUTHORITY']]};
}
