import {wpStages,type AiccStatus} from '../workflow.ts';
import type {AiccProjectSnapshot,FormalizationState,LifecycleStage,ResolvedAuthorization,WorkPackageLifecycle} from '../model/entityTypes.ts';

const stage=(id:string,label:string,status:AiccStatus,evidence:string[]=[],reasonCode?:string):LifecycleStage=>({id,label,status,evidence,...(reasonCode?{reasonCode}:{})});
export function resolveWorkPackageLifecycle(id:string,formalization:FormalizationState,authorization:ResolvedAuthorization,snapshot:AiccProjectSnapshot):WorkPackageLifecycle{
  const uat=snapshot.humanUat.value?.find(record=>record.workPackageId===id);
  const runtime=snapshot.runtime.value?.workPackageId===id?snapshot.runtime.value:null;
  let statuses:Record<string,AiccStatus>={PLANNED:'NOT_STARTED',READY:'NOT_STARTED',OWNER_AUTHORIZATION:'NOT_STARTED',IMPLEMENTATION:'NOT_STARTED',VALIDATION:'NOT_STARTED',REVIEW:'N_A',DELIVERY:'N_A',HUMAN_UAT:'NOT_STARTED',CLOSED:'NOT_STARTED'};
  let currentStage='PLANNED',effectiveStatus:AiccStatus='NOT_STARTED';
  if(uat){const uatStatus=uat.status==='IN_PROGRESS'?'WAITING_UAT':uat.status==='PASS'?'PASS':uat.status==='NEEDS_REMEDIATION'?'BLOCKED':'NOT_STARTED';statuses={...statuses,PLANNED:'COMPLETE',READY:'COMPLETE',OWNER_AUTHORIZATION:'COMPLETE',IMPLEMENTATION:'COMPLETE',VALIDATION:'COMPLETE',REVIEW:'N_A',DELIVERY:'N_A',HUMAN_UAT:uatStatus};currentStage='HUMAN_UAT';effectiveStatus=statuses.HUMAN_UAT;}
  else if(runtime){const implementationStatus=['STARTING','RUNNING','STOPPING'].includes(runtime.phase)?'IN_PROGRESS':runtime.phase==='COMPLETED'&&runtime.implementationResult==='CODE_CHANGE_PRESENT'?'COMPLETE':runtime.phase==='COMPLETED'&&runtime.implementationResult==='NO_IMPLEMENTATION_CHANGE'?'BLOCKED':runtime.phase==='COMPLETED'?'BLOCKED':'FAILED';statuses={...statuses,PLANNED:'COMPLETE',READY:'COMPLETE',OWNER_AUTHORIZATION:'COMPLETE',IMPLEMENTATION:implementationStatus};currentStage='IMPLEMENTATION';effectiveStatus=statuses.IMPLEMENTATION;}
  else if(authorization.state==='VALID'){statuses={...statuses,PLANNED:'COMPLETE',READY:'COMPLETE',OWNER_AUTHORIZATION:'COMPLETE'};currentStage='IMPLEMENTATION';effectiveStatus='NOT_STARTED';}
  else if(formalization==='FORMAL_READY'){statuses={...statuses,PLANNED:'COMPLETE',READY:'COMPLETE',OWNER_AUTHORIZATION:'WAITING_OWNER'};currentStage='OWNER_AUTHORIZATION';effectiveStatus='WAITING_OWNER';}
  else if(formalization==='FORMAL_INVALID'){statuses.PLANNED='BLOCKED';effectiveStatus='BLOCKED';}
  const stages=wpStages.map(([id,label])=>stage(id,label,statuses[id],statuses[id]==='N_A'?['此启动流程没有对应证据要求。']:[],statuses[id]==='N_A'?'STAGE_NOT_APPLICABLE':undefined));
  return {currentStage,effectiveStatus,stages};
}
