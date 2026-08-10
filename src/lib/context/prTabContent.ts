import type {PullRequestEntityContext} from '../model/entityTypes.ts';

export const prTabIds=['概览','流程','Diff','Review','CI','Merge','证据'] as const;
export type PrTabId=typeof prTabIds[number];
export type PrTabView={tab:PrTabId;title:string;rows:Array<[string,string]>;description?:string};
const value=(value:string|number|undefined|null,empty='NOT_BOUND')=>value===undefined||value===null||value===''?empty:String(value);

export function resolvePrTabView(context:PullRequestEntityContext,activeTab:string):PrTabView{
  const tab=(prTabIds.includes(activeTab as PrTabId)?activeTab:'概览') as PrTabId;
  const record=context.record;
  const fixture=record?.fixture===true;
  const common:[string,string][]=[['PR identity',fixture?'PR #DEMO — Dual Panel Fixture':context.id],['Source',fixture?'DEMO · LOCAL FIXTURE':'PRODUCTION'],['Parent WP',value(context.parentWorkPackageId)],['Status',context.statusLabel]];
  if(tab==='概览')return {tab,title:'PR 概览',rows:[...common,['Source / Target',`${value(record?.sourceBranch,'ABSENT')} → ${value(record?.targetBranch,'ABSENT')}`],['PR HEAD',value(record?.headSha)],['Mergeability',value(record?.mergeability,'NOT_RUN')],['Merge result',value(record?.mergeResult,'NOT_RUN')]]};
  if(tab==='流程')return {tab,title:'PR 流程',description:`当前阶段：${context.currentStage} · ${fixture?'本地 Fixture，不代表真实交付状态。':'当前来源未提供生产流程证据。'}`,rows:context.stages.map(stage=>[stage.id,stage.status])};
  if(tab==='Diff')return {tab,title:'Diff',rows:[['Source',fixture?'DEMO · LOCAL FIXTURE':'PRODUCTION'],['Production PR',fixture?'ABSENT':'UNAVAILABLE'],['Files changed',value(record?.filesChanged, '0')],['Diff','NOT_BOUND / ABSENT']]};
  if(tab==='Review')return {tab,title:'Review',rows:[['Review','NOT_RUN'],['Reviewer','NOT_BOUND'],['Review evidence','ABSENT']]};
  if(tab==='CI')return {tab,title:'Exact-head CI',rows:[['Exact-head CI','NOT_RUN'],['CI provider','NOT_BOUND'],['CI run','ABSENT']]};
  if(tab==='Merge')return {tab,title:'Merge',rows:[['Mergeability','NOT_RUN'],['Ready to Merge','NOT_RUN'],['Merge Result','NOT_RUN'],['Merge SHA','ABSENT']]};
  return {tab,title:'PR 证据',description:'此 Fixture 仅用于本地 Owner UI UAT，不是生产 GitHub 证据。',rows:[['Source','DEMO · LOCAL FIXTURE'],['Parent WP',value(context.parentWorkPackageId)],['Production PR','ABSENT'],['GitHub PR','NOT_BOUND'],['PR HEAD','NOT_BOUND'],['Exact-head CI','NOT_RUN'],['Review','NOT_RUN'],['Merge','NOT_RUN']]};
}
