import type {ExactHeadValidation} from './exactHeadEvidence.ts';
import type {PullRequestRecord,RuntimeRecord} from './model/entityTypes.ts';
import type {PrLayer2Record} from './prCanonicalProjection.ts';

export const prLifecycleGateIds=['DELIVERY_READY','COMMIT','PUSH','DRAFT_PR','EXACT_HEAD_CI','READY_TO_MERGE','MERGE_AND_VERIFY'] as const;
export type PrLifecycleGateId=typeof prLifecycleGateIds[number];
export type PrLifecycleGateState='COMPLETE'|'CURRENT'|'BLOCKED'|'PENDING'|'NOT_APPLICABLE'|'UNPROVEN';
export type PrLifecycleGate={id:PrLifecycleGateId;label:string;state:PrLifecycleGateState;reason:string};
export type PrLifecycleWorkspace={prState:'DRAFT'|'OPEN'|'MERGED'|'CLOSED'|'UNKNOWN';lifecycleStatus:'IN_PROGRESS'|'BLOCKED'|'COMPLETE'|'UNKNOWN';gates:PrLifecycleGate[];currentAction:string;remoteIdentityConfirmed:boolean};

const labels:Record<PrLifecycleGateId,string>={DELIVERY_READY:'交付准备',COMMIT:'Commit',PUSH:'Push',DRAFT_PR:'Draft PR',EXACT_HEAD_CI:'Exact-head CI',READY_TO_MERGE:'Ready',MERGE_AND_VERIFY:'Merge / Verify'};
const stateLabels:Record<PrLifecycleGateState,string>={COMPLETE:'已完成',CURRENT:'当前',BLOCKED:'阻塞',PENDING:'待执行',NOT_APPLICABLE:'不适用',UNPROVEN:'未证明'};

export function prLifecycleStateLabel(state:PrLifecycleGateState){return stateLabels[state];}

function hasText(value:unknown){return typeof value==='string'&&value.trim().length>0;}
function hasExplicitNotApplicable(value:unknown){return typeof value==='string'&&['NOT_APPLICABLE','N_A'].includes(value.trim().toUpperCase());}
function hasExplicitBlocker(value:unknown){return typeof value==='string'&&['BLOCKED','FAILED','ERROR'].includes(value.trim().toUpperCase());}
function stateForStatus(value:unknown):PrLifecycleGateState{
  if(hasExplicitBlocker(value))return 'BLOCKED';
  if(hasExplicitNotApplicable(value))return 'NOT_APPLICABLE';
  if(hasText(value)&&['PASS','SUCCESS','COMPLETE','COMPLETED','MERGED','READY'].includes(String(value).trim().toUpperCase()))return 'COMPLETE';
  if(hasText(value)&&['CURRENT','IN_PROGRESS','RUNNING'].includes(String(value).trim().toUpperCase()))return 'CURRENT';
  if(hasText(value)&&['PENDING','WAITING'].includes(String(value).trim().toUpperCase()))return 'PENDING';
  return 'UNPROVEN';
}
function stateForPresence(value:unknown):PrLifecycleGateState{
  if(!hasText(value)||['NOT_BOUND','NOT_RUN','NOT_AVAILABLE','ABSENT','UNKNOWN'].includes(String(value).trim().toUpperCase()))return 'UNPROVEN';
  const state=stateForStatus(value);
  return state==='UNPROVEN'?'COMPLETE':state;
}
function explicitGateState(record:PullRequestRecord,id:PrLifecycleGateId,fallback:PrLifecycleGateState):PrLifecycleGateState{
  const value=record.lifecycleGateStates?.[id];
  return value===undefined?fallback:stateForStatus(value);
}
function gate(id:PrLifecycleGateId,state:PrLifecycleGateState,reason:string):PrLifecycleGate{return {id,label:labels[id],state,reason};}

export function projectPrLifecycleWorkspace(record:PullRequestRecord|null,validation:ExactHeadValidation|null,runtime:RuntimeRecord|null,projection:PrLayer2Record|null=null):PrLifecycleWorkspace{
  // Layer 2 owns the displayed PR lifecycle fact. This workspace only projects gates.
  const prState=projection?.presentationLifecycle??record?.state??'UNKNOWN';
  if(!record)return {prState,lifecycleStatus:'UNKNOWN',gates:prLifecycleGateIds.map((id)=>gate(id,'UNPROVEN','当前没有可验证的 PR 事实。')),currentAction:'当前操作 = 未证明',remoteIdentityConfirmed:false};
  const merged=prState==='MERGED';
  const mergeability=record.mergeability;
  const mergeResult=record.mergeResult;
  const explicitBlocker=hasExplicitBlocker(record.status)||hasExplicitBlocker(mergeability)||hasExplicitBlocker(mergeResult)||runtime?.phase==='FAILED';
  const commit=explicitGateState(record,'COMMIT',stateForStatus(record.latestCommit??record.commitEvidence));
  const push=explicitGateState(record,'PUSH',stateForPresence(record.deliveryHeadSha??record.headSha));
  const draft=explicitGateState(record,'DRAFT_PR',record.draft===true||prState==='DRAFT'?'COMPLETE':record.url?'COMPLETE':'UNPROVEN');
  const ci=explicitGateState(record,'EXACT_HEAD_CI',validation?.ci.current_for_head?stateForStatus(validation.ci.conclusion):'UNPROVEN');
  const mergeabilityState=stateForStatus(mergeability);
  const ready=explicitGateState(record,'READY_TO_MERGE',merged?'NOT_APPLICABLE':explicitBlocker?'BLOCKED':mergeabilityState==='NOT_APPLICABLE'?'NOT_APPLICABLE':ci==='COMPLETE'&&mergeabilityState==='COMPLETE'?'COMPLETE':'UNPROVEN');
  const mergeVerify=explicitGateState(record,'MERGE_AND_VERIFY',merged?'COMPLETE':explicitBlocker?'BLOCKED':stateForStatus(mergeResult));
  const gates=[
    gate('DELIVERY_READY',explicitGateState(record,'DELIVERY_READY','UNPROVEN'),record.lifecycleGateStates?.DELIVERY_READY?'Explicit delivery-ready evidence is present.':'No delivery-ready evidence is recorded.'),
    gate('COMMIT',commit,'Latest commit evidence is not established.'),
    gate('PUSH',push,'Push/PR HEAD evidence is not established.'),
    gate('DRAFT_PR',draft,'PR identity and draft state are factual remote PR fields.'),
    gate('EXACT_HEAD_CI',ci,validation?.ci.current_for_head?'Current-head CI evidence is present.':'Current-head CI evidence is not established.'),
    gate('READY_TO_MERGE',ready,merged?'Merged PRs do not require a separate ready-to-merge gate.':'Merge readiness requires explicit evidence.'),
    gate('MERGE_AND_VERIFY',mergeVerify,merged?'Remote merge fact is confirmed.':'Merge and verification evidence is not established.')
  ];
  // Gate rows are evidence formatting only. The displayed PR lifecycle has
  // exactly one source: the Phase 3 Layer 2 PR projection.
  const lifecycleStatus=projection?.lifecycleStatus??'UNKNOWN';
  const currentAction=lifecycleStatus==='COMPLETE'?'当前操作 = 已完成':lifecycleStatus==='BLOCKED'?'当前操作 = 阻塞':lifecycleStatus==='IN_PROGRESS'?'当前操作 = 执行中':'当前操作 = 未证明';
  return {prState,lifecycleStatus,gates,currentAction,remoteIdentityConfirmed:Boolean(record.url&&record.repository&&record.number)};
}
