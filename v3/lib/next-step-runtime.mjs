import {createHash,randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,readdirSync,renameSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {stateRoot} from './project-context.mjs';
import {validateProviderDecision} from './provider-routing.mjs';
import {formatNextStepUiPreviewPolicy,validateNextStepUiPreviewPolicy} from './ui-preview-policy-runtime.mjs';

export const NEXT_STEP_STATES=Object.freeze(['PENDING','CLAIMED','EXECUTION_QUEUED','STOP_GATE','ABORTED_BEFORE_SEND','UNCERTAIN']);
export const NEXT_STEP_SNAPSHOT_MAX_AGE_MS=90000;
const NEXT_STEP_SNAPSHOT_FUTURE_SKEW_MS=5000;
function fail(code){const error=new Error(code);error.code=code;throw error;}
function now(options){return (options.now||(()=>new Date().toISOString()))();}
function sha256(value){return createHash('sha256').update(value).digest('hex');}
function root(_context,env){return join(stateRoot(env),'v5-next-step');}
function requestDir(context,id,env){return join(root(context,env),'requests',id);}
function requestFile(context,id,env){return join(requestDir(context,id,env),'request.v1.json');}
function stateFile(context,id,env){return join(requestDir(context,id,env),'state.v1.json');}
function atomic(path,value){mkdirSync(dirname(path),{recursive:true});const temp=`${path}.${process.pid}.tmp`;writeFileSync(temp,`${JSON.stringify(value,null,2)}\n`);renameSync(temp,path);}
function text(value,code,max=12000){if(typeof value!=='string'||!value.trim()||value.length>max)fail(code);return value.trim();}
function optionalText(value,max=4000){if(value==null||value==='')return '';if(typeof value!=='string'||value.length>max)fail('NEXT_STEP_INPUT_INVALID');return value.trim();}
function localRemote(remote){return ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote||'');}
export function assertNextStepLocal(remote){if(!localRemote(remote))fail('NEXT_STEP_LOCAL_ONLY');return true;}

function canonicalEvidence(context,facts){
  const work=facts?.work||{};const delivery=facts?.prDelivery||{};
  const activeWp=(work.workPackages||[]).find(item=>['ACTIVE','BLOCKED','OPEN'].includes(item?.status))||null;
  const activeTask=(work.tasks||[]).find(item=>['IN_PROGRESS','BLOCKED','TODO'].includes(item?.status))||null;
  return {runtime:{branch:context.repository.branch,head:context.repository.head,dirty:context.repository.dirty},currentWorkPackage:activeWp?{id:activeWp.id,title:activeWp.title,status:activeWp.status}:null,currentTask:activeTask?{id:activeTask.id,title:activeTask.title,status:activeTask.status}:null,pullRequests:(delivery.pullRequests||[]).map(pr=>({number:pr.number,title:pr.title,state:pr.state,isDraft:Boolean(pr.isDraft),head:pr.headRefOid})),checks:(delivery.checks||[]).map(check=>({name:check.name,status:check.status,conclusion:check.conclusion,head:check.headSha}))};
}
export function nextStepPrompt(input){
  const draft=optionalText(input.draft,4000);const evidence=input.canonicalEvidence||{};
  const uiPreview= formatNextStepUiPreviewPolicy(input.uiPreviewPolicy);
  return `${uiPreview}\n\nAICC V5.4 NEXT-STEP REQUEST\nYou are the planning/review GPT already bound to this exact AICC Execution Room.\nGitHub and the supplied runtime facts are the only code/execution source of truth. Decide exactly one next action. Do not claim execution yourself.\n\nROOM\nname: ${text(input.roomName,'NEXT_STEP_INPUT_INVALID',240)}\nroom_id: ${text(input.roomId,'NEXT_STEP_INPUT_INVALID',240)}\nworkstream: ${text(input.workstreamId,'NEXT_STEP_INPUT_INVALID',240)}\nbranch: ${text(input.branch,'NEXT_STEP_INPUT_INVALID',500)}\nworktree: ${text(input.worktree,'NEXT_STEP_INPUT_INVALID',2000)}\nhead: ${text(input.head,'NEXT_STEP_INPUT_INVALID',100)}\nconversation_id: ${text(input.conversationId,'NEXT_STEP_INPUT_INVALID',500)}\nowner_draft: ${draft||'(none)'}\n\nCANONICAL_EVIDENCE\n${JSON.stringify(evidence,null,2)}\n\nInfer the exact current Task from CANONICAL_EVIDENCE before deciding. Prefer an existing IN_PROGRESS/BLOCKED/TODO task. If none exists, infer one bounded task from the exact branch, PR and CI evidence; do not invent completed work.\n\nReturn ONLY this protocol, with no prose before it:\nAICC_NEXT_STEP_V1\nAICC_DECISION: EXECUTE|STOP_GATE\nAICC_ACTION_CLASS: CODE_CHANGE|TEST_ONLY|STOP_GATE\nAICC_PROVIDER: CLAUDE_CODE|CODEX\nAICC_PROVIDER_ROUTING_REASON: <required for EXECUTE; routing reason>\nAICC_WORK_PACKAGE: <required for EXECUTE; short title>\nAICC_TASK: <required for EXECUTE; exact task name>\nAICC_INSTRUCTION_BEGIN\n<required for EXECUTE; exact executor instruction, bounded to one task, include tests/evidence and STOP gates>\nAICC_INSTRUCTION_END\nAICC_GATE_REASON: <required for STOP_GATE; otherwise NONE>\n\nDefault routing: CODE_CHANGE -> CLAUDE_CODE; TEST_ONLY -> CODEX. Choose STOP_GATE for merge/deploy/production data write/Owner UAT/external authorization/architecture changes, or whenever evidence is insufficient. For EXECUTE, ACTION_CLASS must be CODE_CHANGE or TEST_ONLY and the instruction must not contain merge, deploy, production apply/write, or --apply operations.`;
}
function activeState(state){return ['PENDING','CLAIMED'].includes(state);}
function listIds(context,env){const dir=join(root(context,env),'requests');if(!existsSync(dir))return [];return readdirSync(dir).sort();}
export function readNextStepRequest(context,id,env=process.env){let req,state;try{req=JSON.parse(readFileSync(requestFile(context,id,env),'utf8'));state=JSON.parse(readFileSync(stateFile(context,id,env),'utf8'));}catch{fail('NEXT_STEP_NOT_FOUND');}if(req?.schema!=='aicc.v5.next-step-request.v1'||state?.schema!=='aicc.v5.next-step-state.v1'||req.requestId!==id||state.requestId!==id||!NEXT_STEP_STATES.includes(state.state))fail('NEXT_STEP_INVALID');return {request:req,state};}
export function latestNextStepForRoom(context,roomId,env=process.env){let latest=null;for(const id of listIds(context,env)){try{const value=readNextStepRequest(context,id,env);if(value.request.roomId!==roomId)continue;if(!latest||value.request.createdAt>latest.request.createdAt)latest=value;}catch{}}return latest;}
export function createNextStepRequest(context,input,facts,env=process.env,options={}){
  const expectedBranch=text(input?.branch,'NEXT_STEP_INPUT_INVALID',500);const expectedWorktree=text(input?.worktree,'NEXT_STEP_INPUT_INVALID',2000);const expectedHead=text(input?.head,'NEXT_STEP_INPUT_INVALID',100);
  if(context.repository.branch!==expectedBranch||context.repository.path!==expectedWorktree||context.repository.head!==expectedHead)fail('NEXT_STEP_RUNTIME_DRIFT');
  if(context.repository.dirty)fail('NEXT_STEP_WORKTREE_DIRTY');
  if(!facts?.executorReady)fail('NEXT_STEP_EXECUTOR_NOT_READY');
  if(facts?.activeRun)fail('NEXT_STEP_EXECUTOR_BUSY');
  const createdAt=now(options);
  const conversationId=text(input?.conversationId,'NEXT_STEP_CONVERSATION_REQUIRED',500);const snapshot=facts?.snapshot;
  const capturedAt=Date.parse(snapshot?.capturedAt||'');const currentAt=Date.parse(createdAt);
  if(!snapshot||snapshot.conversationId!==conversationId||!Number.isFinite(capturedAt)||!Number.isFinite(currentAt)||currentAt-capturedAt>NEXT_STEP_SNAPSHOT_MAX_AGE_MS||capturedAt-currentAt>NEXT_STEP_SNAPSHOT_FUTURE_SKEW_MS)fail('NEXT_STEP_CONVERSATION_STALE');
  const existing=latestNextStepForRoom(context,text(input?.roomId,'NEXT_STEP_INPUT_INVALID',240),env);if(existing&&activeState(existing.state.state))fail('NEXT_STEP_ACTIVE');
  const requestId=(options.uuid||randomUUID)();
  const frozen={roomId:input.roomId,roomName:input.roomName,workstreamId:input.workstreamId,branch:expectedBranch,worktree:expectedWorktree,head:context.repository.head,conversationId,draft:input?.draft||'',canonicalEvidence:canonicalEvidence(context,facts),uiPreviewPolicy:validateNextStepUiPreviewPolicy(options.uiPreviewPolicy)};
  const prompt=nextStepPrompt(frozen);
  const request={schema:'aicc.v5.next-step-request.v1',requestId,projectId:context.project.id,projectName:context.project.name,repositoryIdentity:context.repository.identity,...frozen,conversationUrl:snapshot.conversationUrl,prompt,promptSha256:sha256(prompt),createdAt};
  const state={schema:'aicc.v5.next-step-state.v1',requestId,state:'PENDING',claim:null,bridgeRequestId:null,runId:null,decision:null,errorCode:null,updatedAt:createdAt};
  const dir=requestDir(context,requestId,env);mkdirSync(dirname(dir),{recursive:true});mkdirSync(dir,{recursive:false});writeFileSync(requestFile(context,requestId,env),`${JSON.stringify(request,null,2)}\n`,{flag:'wx'});atomic(stateFile(context,requestId,env),state);return {request,state};
}
export function claimNextStep(context,input,env=process.env,options={}){
  const bridgeInstanceId=text(input?.bridgeInstanceId,'NEXT_STEP_INPUT_INVALID',500);
  for(const id of listIds(context,env)){
    const value=readNextStepRequest(context,id,env);if(value.state.state!=='PENDING')continue;
    const claim={claimId:(options.uuid||randomUUID)(),bridgeInstanceId,claimedAt:now(options)};const state={...value.state,state:'CLAIMED',claim,updatedAt:now(options)};atomic(stateFile(context,id,env),state);return {request:value.request,state};
  }
  return null;
}
export function recordNextStepReceipt(context,id,input,env=process.env,options={}){
  const value=readNextStepRequest(context,id,env);if(value.state.state!=='CLAIMED'||!value.state.claim||input?.claimId!==value.state.claim.claimId)fail('NEXT_STEP_CLAIM_MISMATCH');
  const outcome=input?.outcome;if(!['EXECUTION_QUEUED','STOP_GATE','ABORTED_BEFORE_SEND','UNCERTAIN'].includes(outcome))fail('NEXT_STEP_RECEIPT_INVALID');
  if(outcome==='EXECUTION_QUEUED'){
    const d=input?.decision;
    try{validateProviderDecision({executionClass:d?.actionClass,provider:d?.provider,providerRoutingReason:d?.providerRoutingReason});}
    catch{fail('NEXT_STEP_RECEIPT_PROVIDER_MISSING');}
  }
  const state={...value.state,state:outcome,bridgeRequestId:typeof input?.bridgeRequestId==='string'?input.bridgeRequestId:null,runId:typeof input?.runId==='string'?input.runId:null,decision:input?.decision&&typeof input.decision==='object'?input.decision:null,errorCode:typeof input?.errorCode==='string'?input.errorCode:null,claim:null,updatedAt:now(options)};
  if(outcome==='EXECUTION_QUEUED'&&!state.bridgeRequestId)fail('NEXT_STEP_RECEIPT_INVALID');atomic(stateFile(context,id,env),state);return {request:value.request,state};
}
export function reconcileNextStepStartup(context,env=process.env,options={}){const changed=[];for(const id of listIds(context,env)){try{const value=readNextStepRequest(context,id,env);if(value.state.state!=='CLAIMED')continue;const state={...value.state,state:'UNCERTAIN',claim:null,errorCode:'NEXT_STEP_RESTART_AFTER_CLAIM',updatedAt:now(options)};atomic(stateFile(context,id,env),state);changed.push(id);}catch{}}return changed;}

export function cancelPendingNextStepForRoom(_context,roomId,env=process.env,options={}){
  const room=text(roomId,'NEXT_STEP_INPUT_INVALID',240);const cancelled=[];const claimed=[];
  for(const id of listIds(null,env)){
    try{
      const value=readNextStepRequest(null,id,env);if(value.request.roomId!==room)continue;
      if(value.state.state==='CLAIMED'){claimed.push(id);continue;}
      if(value.state.state!=='PENDING')continue;
      const state={...value.state,state:'ABORTED_BEFORE_SEND',claim:null,errorCode:'NEXT_STEP_ROOM_INACTIVE',updatedAt:now(options)};
      atomic(stateFile(null,id,env),state);cancelled.push(id);
    }catch{}
  }
  return {cancelled,claimed};
}
