import type {AiccStatus} from './workflow.ts';
import type {LifecycleStage} from './model/entityTypes.ts';
import type {RuntimeRecord} from './model/entityTypes.ts';

export function resolveLifecycleProgress(stages:LifecycleStage[]):number|null{
  const applicable=stages.filter(stage=>!['N_A','SKIPPED'].includes(stage.status));
  if(!applicable.length)return stages.length?0:null;
  const completed=applicable.filter(stage=>['PASS','COMPLETE'].includes(stage.status)).length;
  return Math.round(completed/applicable.length*100);
}
export function resolveStatusProgress(status:AiccStatus):number|null{
  if(status==='NOT_STARTED'||status==='N_A')return 0;
  if(status==='WAITING_OWNER')return 29;
  if(status==='WAITING_UAT')return 71;
  if(status==='IN_PROGRESS')return 50;
  if(status==='PASS'||status==='COMPLETE')return 100;
  if(status==='BLOCKED'||status==='FAILED')return 0;
  return null;
}
export function resolveMilestoneProgress(childProgress:(number|null)[]):number|null{
  const values=childProgress.filter((value):value is number=>typeof value==='number');
  return values.length?Math.round(values.reduce((sum,value)=>sum+value,0)/values.length):null;
}
export function resolveRuntimeImplementationProgress(runtime:RuntimeRecord|null):number|null{
  if(!runtime)return null;
  const implementation=runtime.phase==='COMPLETED'&&runtime.implementationResult==='CODE_CHANGE_PRESENT'?'COMPLETE':runtime.phase==='COMPLETED'&&runtime.implementationResult==='NO_IMPLEMENTATION_CHANGE'?'BLOCKED':['STARTING','RUNNING','STOPPING'].includes(runtime.phase)?'IN_PROGRESS':'NOT_STARTED';
  return resolveLifecycleProgress(['COMPLETE','COMPLETE','COMPLETE',implementation,'NOT_STARTED','N_A','N_A','NOT_STARTED','NOT_STARTED'].map((status,index)=>({id:String(index),label:String(index),status,evidence:[]} as LifecycleStage)));
}
