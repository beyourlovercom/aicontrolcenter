import {wpStages,type AiccStatus} from '../workflow.ts';
import type {AiccProjectSnapshot,FormalizationState,LifecycleStage,ResolvedAuthorization,WorkPackageLifecycle} from '../model/entityTypes.ts';
import {scopedEntityKey} from '../projectEntityScope.ts';

const stage=(id:string,label:string,status:AiccStatus,evidence:string[]=[],reasonCode?:string):LifecycleStage=>({id,label,status,evidence,...(reasonCode?{reasonCode}:{})});
const complete=(value?:string)=>Boolean(value&&/^(PASS|COMPLETE|CLOSED|APPROVED_BASELINE)$/i.test(value.trim()));
const notApplicable=(value?:string)=>!value||/^(N_A|NA|NOT_APPLICABLE|NONE|NO)$/i.test(value.trim());
const contractFields=(fields:Record<string,string>)=>Object.fromEntries(Object.entries(fields).map(([key,value])=>[key.toUpperCase().replace(/[\s-]+/g,'_'),value]));

/**
 * The only lifecycle authority used by Entity Context and the Roadmap read model.
 * Contract text describes applicability; persisted evidence and terminal runtime
 * facts establish completion. Presentation components must not infer stages.
 */
export function resolveWorkPackageLifecycle(wp:Readonly<{id:string;identityKey:string}>,scope:Readonly<{projectId:string;repositoryIdentity:string}>,formalization:FormalizationState,authorization:ResolvedAuthorization,snapshot:AiccProjectSnapshot):WorkPackageLifecycle{
  if(!scope?.projectId||!scope.repositoryIdentity||wp.identityKey!==scopedEntityKey(scope,'WORK_PACKAGE',wp.id))throw new Error('WP_PROJECT_SCOPE_REQUIRED');
  const id=wp.id;
  const formal=snapshot.formalWorkPackages.value?.[id];
  const uat=snapshot.humanUat.value?.find(record=>record.repository===scope.repositoryIdentity&&record.workPackageId===id)??null;
  const evidence=snapshot.lifecycleEvidence.value?.find(item=>item.repository===scope.repositoryIdentity&&item.workPackageId===id)??null;
  const runtime=(()=>{const candidate=snapshot.runtime.value as any;return candidate?.projectId===scope.projectId&&candidate?.repositoryIdentity===scope.repositoryIdentity&&candidate.workPackageId===id?candidate:null})();
  const fields=contractFields(formal?.fields??{});
  const statuses:Record<string,AiccStatus>={PLANNED:'NOT_STARTED',READY:'NOT_STARTED',OWNER_AUTHORIZATION:'NOT_STARTED',IMPLEMENTATION:'NOT_STARTED',VALIDATION:'NOT_STARTED',REVIEW:'N_A',DELIVERY:'N_A',HUMAN_UAT:'NOT_STARTED',CLOSED:'NOT_STARTED'};
  const evidenceByStage:Record<string,string[]>={};
  const mark=(id:string,status:AiccStatus,...facts:string[])=>{statuses[id]=status;if(facts.length)evidenceByStage[id]=facts;};

  if(formalization==='FORMAL_INVALID'){
    mark('PLANNED','BLOCKED','正式 Work Package 不可解析。');
  } else if(!formal){
    mark('PLANNED','NOT_STARTED','尚未发现正式 Work Package 合同。');
    for(const key of ['READY','OWNER_AUTHORIZATION','IMPLEMENTATION','VALIDATION','REVIEW','DELIVERY','HUMAN_UAT','CLOSED'])mark(key,'N_A','未进入该生命周期。');
  } else {
    mark('PLANNED','COMPLETE','正式 Work Package 合同已发现。');
    mark('READY','COMPLETE','正式 Work Package 合同已通过结构读取。');

    const closedContract=complete(fields.PACKAGE_STATUS)&&complete(fields.IMPLEMENTATION)&&complete(fields.MACHINE_VALIDATION)&&complete(fields.HUMAN_UAT);
    if(closedContract){
      mark('OWNER_AUTHORIZATION','COMPLETE','Owner-approved closed Work Package contract。');
      mark('IMPLEMENTATION','COMPLETE','正式合同记录实现已完成。');
      mark('VALIDATION','COMPLETE','正式合同记录机器验证已完成。');
      mark('HUMAN_UAT','PASS','Owner Human UAT 通过证据已记录。');
      mark('CLOSED','COMPLETE','正式合同记录 Work Package 已关闭。');
    }
    const authRequired=!/^(false|no|0)$/i.test(fields.REQUIRES_AUTHORIZATION??'');
    if(closedContract){
      // Closed contract facts are authoritative; do not re-open an earlier gate.
    } else {
    if(!authRequired||authorization.state==='VALID'||complete(fields.OWNER_AUTHORIZATION))mark('OWNER_AUTHORIZATION','COMPLETE','授权合同或有效授权证据已满足。');
    else mark('OWNER_AUTHORIZATION','WAITING_OWNER','等待 Owner 授权。');

    const runtimeActive=Boolean(runtime&&['STARTING','RUNNING','STOPPING'].includes(runtime.phase));
    const implementationComplete=Boolean(evidence?.implementation.status==='COMPLETE'||complete(fields.IMPLEMENTATION)||complete(fields.IMPLEMENTATION_STATUS)||(runtime?.phase==='COMPLETED'&&runtime.implementationResult==='CODE_CHANGE_PRESENT'));
    const implementationFailed=Boolean(evidence?.implementation.status==='FAILED'||/^(FAILED|FAIL|BLOCKED)$/i.test(fields.IMPLEMENTATION??''));
    if(implementationFailed)mark('IMPLEMENTATION','FAILED','实现证据明确失败。');
    else if(runtimeActive)mark('IMPLEMENTATION','IN_PROGRESS','Runtime 正在执行。');
    else if(implementationComplete)mark('IMPLEMENTATION','COMPLETE','实现完成证据已持久化或由终态运行产生。');

    const validationFailed=Boolean(evidence?.validation.status==='FAILED'||/^(FAILED|FAIL|BLOCKED)$/i.test(fields.VALIDATION??''));
    const validationComplete=Boolean(evidence?.validation.status==='COMPLETE'||complete(fields.VALIDATION)||complete(fields.MACHINE_VALIDATION));
    if(validationFailed)mark('VALIDATION','FAILED','验证证据明确失败。');
    else if(validationComplete)mark('VALIDATION','COMPLETE','验证完成证据已持久化。');

    for(const key of ['REVIEW','DELIVERY']){
      const requirement=fields[`${key}_APPLICABILITY`]??fields[`${key} APPLICABILITY`]??fields[key];
      if(notApplicable(requirement))mark(key,'N_A','正式合同未要求该阶段。');
      else if(complete(requirement)||complete(fields[`${key}_STATUS`]))mark(key,'COMPLETE',`${key} 合同证据已满足。`);
      else mark(key,'NOT_STARTED',`正式合同要求 ${key}。`);
    }

    const humanPass=uat?.status==='PASS'||complete(fields.HUMAN_UAT);
    const humanFail=uat?.status==='NEEDS_REMEDIATION'||/^(FAILED|FAIL|BLOCKED)$/i.test(fields.HUMAN_UAT??'');
    const prerequisites=['OWNER_AUTHORIZATION','IMPLEMENTATION','VALIDATION','REVIEW','DELIVERY'].every(key=>['COMPLETE','PASS','N_A'].includes(statuses[key]));
    if(humanFail)mark('HUMAN_UAT','BLOCKED','Human UAT 明确需要整改。');
    else if(humanPass)mark('HUMAN_UAT','PASS','Owner Human UAT 通过证据已记录。');
    else if(prerequisites)mark('HUMAN_UAT','WAITING_UAT','机器前置阶段已完成，等待 Owner 人工验收。');

    const closed=Boolean(evidence?.closure?.status==='COMPLETE'||(humanPass&&/^(CLOSED|COMPLETE)$/i.test(fields.PACKAGE_STATUS??'')));
    if(closed)mark('CLOSED','COMPLETE','Work Package 关闭证据已记录。');
    }
  }

  const stages=wpStages.map(([stageId,label])=>stage(stageId,label,statuses[stageId],evidenceByStage[stageId]??[],statuses[stageId]==='N_A'?'STAGE_NOT_APPLICABLE':undefined));
  const failure=stages.find(item=>item.status==='BLOCKED'||item.status==='FAILED');
  if(failure)return {currentStage:failure.id,effectiveStatus:failure.status,stages};
  const current=stages.find(item=>!['COMPLETE','PASS','N_A'].includes(item.status));
  if(current)return {currentStage:current.id,effectiveStatus:current.status==='NOT_STARTED'&&['VALIDATION','REVIEW','DELIVERY','CLOSED'].includes(current.id)?'IN_PROGRESS':current.status,stages};
  if(statuses.CLOSED==='COMPLETE')return {currentStage:'CLOSED',effectiveStatus:'COMPLETE',stages};
  return {currentStage:'CLOSED',effectiveStatus:'IN_PROGRESS',stages};
}
