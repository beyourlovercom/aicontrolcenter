import type { ExecutorFactsProjection } from './executorFacts.ts';
import type { ExecutionRoomState } from './executionRoomState.ts';
import type { NextStepProjection } from './nextStep.ts';

export type ProgressItem={title:string;detail:string;state:'done'|'current'|'pending'|'blocked'};
export type RoomProgressProjection={blueprint:ProgressItem[];workPackages:ProgressItem[];pullRequests:ProgressItem[];tasks:ProgressItem[];gates:ProgressItem[]};
const title=(value:unknown,fallback:string)=>typeof value==='string'&&value.trim()?value.trim():fallback;
const status=(value:unknown)=>typeof value==='string'?value.toUpperCase():'UNKNOWN';
const stateFor=(value:unknown):ProgressItem['state']=>{const s=status(value);if(['DONE','MERGED','SUCCESS','COMPLETED'].includes(s))return'done';if(['BLOCKED','FAILURE','FAILED','STOP_GATE','UNCERTAIN'].includes(s))return'blocked';if(['ACTIVE','IN_PROGRESS','OPEN','PENDING','CLAIMED','EXECUTION_QUEUED','RUNNING'].includes(s))return'current';return'pending';};
const dedupeProgress=(items:ProgressItem[]):ProgressItem[]=>{const rank:Record<ProgressItem['state'],number>={current:4,blocked:3,pending:2,done:1};const byTitle=new Map<string,ProgressItem>();for(const item of items){const existing=byTitle.get(item.title);if(!existing||rank[item.state]>rank[existing.state])byTitle.set(item.title,item);}return [...byTitle.values()];};
export function projectRoomProgress(room:ExecutionRoomState,facts:ExecutorFactsProjection|null,nextStep:NextStepProjection|null,runtimeBinding:'MATCH'|'DRIFT'|'UNAVAILABLE'):RoomProgressProjection{
 const repo=facts?.project.value?.repository;
 const work=facts?.work.value;
 const prs=facts?.prDelivery.value?.pullRequests??[];
 const checks=facts?.prDelivery.value?.checks??[];
 const blueprint:ProgressItem[]=[{title:`${room.projectId} / ${room.workstreamId}`,detail:repo?`${repo.branch} @ ${repo.head.slice(0,8)}`:`${room.branch} @ ${room.baseSha.slice(0,8)}`,state:runtimeBinding==='MATCH'?'done':runtimeBinding==='DRIFT'?'blocked':'pending'}];
 const workPackages=dedupeProgress((work?.workPackages??[]).map((wp:any)=>({title:title(wp.title,'Untitled WP'),detail:`${status(wp.status)} · ${title(wp.id,'no-id').slice(0,8)}`,state:stateFor(wp.status)})));
 const tasks=dedupeProgress((work?.tasks??[]).map((task:any)=>({title:title(task.title,'Untitled Task'),detail:`${status(task.status)} · ${title(task.id,'no-id').slice(0,8)}`,state:stateFor(task.status)})));
 const pullRequests=prs.length?prs.map(pr=>({title:`PR #${pr.number} · ${pr.title}`,detail:`${pr.state}${pr.isDraft?' · DRAFT':''} · ${pr.headRefOid.slice(0,8)}`,state:stateFor(pr.state)})):[{title:'No Room-scoped PR',detail:checks.length?`${checks.length} exact-head checks available`:'No PR / CI evidence',state:'pending' as const}];
 const gateState=nextStep?.state.state??null;
 const gates:ProgressItem[]=[{title:gateState?`Next-Step · ${gateState}`:'Execution Gate',detail:runtimeBinding==='MATCH'?'Exact runtime binding MATCH':`Runtime ${runtimeBinding}`,state:gateState?stateFor(gateState):(runtimeBinding==='MATCH'?'done':runtimeBinding==='DRIFT'?'blocked':'pending')}];
 return {blueprint,workPackages:workPackages.length?workPackages:[{title:'No canonical WP yet',detail:'Room work store is empty',state:'pending'}],pullRequests,tasks:tasks.length?tasks:[{title:'No canonical Task yet',detail:'Room task store is empty',state:'pending'}],gates};
}
