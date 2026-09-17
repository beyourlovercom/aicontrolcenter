import {execFileSync,spawn as nodeSpawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,readdirSync,realpathSync,renameSync,statSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {once} from 'node:events';
import {validateProviderDecision} from './provider-routing.mjs';

export const CLAUDE_BIN='/opt/homebrew/bin/claude';

const ALLOWED_ESCALATION_KEYS=Object.freeze([
  'AICC_GPT_ESCALATION_EVIDENCE',
  'AICC_GPT_EFFORT_ESCALATION_EVIDENCE',
  'AICC_GPT_SUBAGENT_ESCALATION_EVIDENCE'
]);
const ACTIVE_STATES=new Set(['QUEUED','RUNNING']);
const PUBLIC_STATES=new Set(['QUEUED','RUNNING','COMPLETED','FAILED','UNCERTAIN']);

function fail(code){const e=new Error(code);e.code=code;throw e;}
function sha256(value){return createHash('sha256').update(value,'utf8').digest('hex');}
function sameInode(a,b){try{const sa=statSync(a),sb=statSync(b);return sa.dev===sb.dev&&sa.ino===sb.ino;}catch{return false;}}
// Returns true when inode(child) is inode(parent) or is physically beneath it.
function inodeContains(parent,child){
  if(sameInode(parent,child))return true;
  // Walk each prefix segment of child's realpath and compare inodes.
  const sep='/';let p=child;
  for(;;){
    const next=p.lastIndexOf(sep);if(next<=0)break;
    p=p.slice(0,next);
    if(sameInode(parent,p))return true;
  }
  return false;
}
function safeExec(cmd,args,opts={}){
  try{return execFileSync(cmd,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],...opts}).trim();}
  catch{return null;}
}
function atomicJson(path,value){
  const tmp=`${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(tmp,`${JSON.stringify(value,null,2)}\n`,{encoding:'utf8',flag:'wx'});
  renameSync(tmp,path);
}

/** Normalize a GitHub remote/canonical value to owner/repo. */
export function normalizeRepositoryIdentity(remoteUrl){
  if(typeof remoteUrl!=='string'||!remoteUrl.trim())return null;
  const s=remoteUrl.trim();
  let m=s.match(/^https?:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/i);
  if(m)return m[1];
  m=s.match(/^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/i);
  if(m)return m[1];
  if(/^[^/\s]+\/[^/\s]+$/.test(s))return s.replace(/\.git$/i,'');
  return null;
}

export function validateRepositoryRoot(repositoryRoot,allowedRoot){
  if(typeof repositoryRoot!=='string'||!repositoryRoot.trim())fail('REMOTE_RUNNER_PATH_INVALID');
  if(typeof allowedRoot!=='string'||!allowedRoot.trim())fail('REMOTE_RUNNER_ALLOWED_ROOT_MISSING');
  let realRoot;try{realRoot=realpathSync(repositoryRoot.trim());}catch{fail('REMOTE_RUNNER_PATH_NOT_FOUND');}
  let realAllowed;try{realAllowed=realpathSync(allowedRoot.trim());}catch{fail('REMOTE_RUNNER_ALLOWED_ROOT_INVALID');}
  if(!inodeContains(realAllowed,realRoot))fail('REMOTE_RUNNER_PATH_ESCAPE');
  const gitTop=safeExec('git',['-C',realRoot,'rev-parse','--show-toplevel']);
  if(!gitTop||!sameInode(gitTop,realRoot))fail('REMOTE_RUNNER_NOT_GIT_WORKTREE');
  const symRef=safeExec('git',['-C',realRoot,'symbolic-ref','HEAD']);
  if(!symRef)fail('REMOTE_RUNNER_DETACHED_HEAD');
  return realRoot;
}

function validateEnvelope(input,allowedRoot){
  const repositoryIdentity=normalizeRepositoryIdentity(input?.repositoryIdentity);
  const expectedBranch=typeof input?.expectedBranch==='string'?input.expectedBranch.trim():'';
  const expectedHead=typeof input?.expectedHead==='string'?input.expectedHead.trim():'';
  if(!repositoryIdentity)fail('REMOTE_RUNNER_IDENTITY_MISSING');
  if(!expectedBranch)fail('REMOTE_RUNNER_BRANCH_MISSING');
  if(!expectedHead)fail('REMOTE_RUNNER_HEAD_MISSING');
  const realRoot=validateRepositoryRoot(input?.remoteRepositoryRoot,allowedRoot);
  const actualBranch=safeExec('git',['-C',realRoot,'rev-parse','--abbrev-ref','HEAD']);
  if(actualBranch!==expectedBranch)fail('REMOTE_RUNNER_BRANCH_MISMATCH');
  const actualHead=safeExec('git',['-C',realRoot,'rev-parse','HEAD']);
  if(actualHead!==expectedHead)fail('REMOTE_RUNNER_HEAD_MISMATCH');
  const originIdentity=normalizeRepositoryIdentity(safeExec('git',['-C',realRoot,'remote','get-url','origin']));
  if(originIdentity!==repositoryIdentity)fail('REMOTE_RUNNER_IDENTITY_MISMATCH');
  return {realRoot,repositoryIdentity,expectedBranch,expectedHead};
}
function leaseKey(repositoryIdentity,branch){return `${repositoryIdentity}#${branch}`;}

function buildGovernanceEnv(rec,base=process.env){
  const env={...base};
  env.AICC_WORK_PACKAGE_ID=rec.workPackageId;
  env.AICC_PROVIDER_ROUTING_DECISION='CLAUDE_CODE';
  env.AICC_EXECUTION_CLASS=rec.executionClass;
  env.AICC_PROVIDER_ROUTING_REASON=rec.providerRoutingReason;
  if(rec.dryRun)env.AICC_CLAUDE_GOVERNANCE_DRY_RUN='1';
  if(rec._escalationEvidence&&typeof rec._escalationEvidence==='object'){
    for(const key of ALLOWED_ESCALATION_KEYS){
      const value=rec._escalationEvidence[key];
      if(typeof value==='string')env[key]=value;
    }
  }
  return env;
}

/**
 * Parse strict dry-run governance evidence from stdout.
 * Requires WP=<expectedWp>, EXECUTION_CLASS=<expectedClass>, ROUTING=CLAUDE_CODE
 * all present. Returns a deterministic sanitized canonical string on match,
 * null on any missing or mismatched line.
 */
export function extractDryRunEvidence(stdout,expectedWp,expectedExecutionClass){
  if(typeof stdout!=='string'||!stdout.trim())return null;
  if(typeof expectedWp!=='string'||!expectedWp.trim())return null;
  if(typeof expectedExecutionClass!=='string'||!expectedExecutionClass.trim())return null;
  let wp=null,execClass=null,routing=null;
  const seen=new Set();
  for(const raw of stdout.split('\n')){
    const line=raw.trim();if(!line)continue;
    let m,key=null,value=null;
    if((m=line.match(/^WP=(.+)$/))){key='WP';value=m[1].trim();}
    else if((m=line.match(/^EXECUTION_CLASS=(.+)$/))){key='EXECUTION_CLASS';value=m[1].trim();}
    else if((m=line.match(/^ROUTING=(.+)$/))){key='ROUTING';value=m[1].trim();}
    if(!key)continue;
    if(seen.has(key))return null;seen.add(key);
    if(key==='WP')wp=value;else if(key==='EXECUTION_CLASS')execClass=value;else routing=value;
  }
  if(wp!==expectedWp.trim())return null;
  if(execClass!==expectedExecutionClass.trim())return null;
  if(routing!=='CLAUDE_CODE')return null;
  return `DRY_RUN_OK WP=${wp} EXECUTION_CLASS=${execClass} ROUTING=${routing}`;
}

/** Extract the deterministic final user-visible result from Claude stream-json. */
export function extractClaudeFinalResult(stdout){
  if(typeof stdout!=='string'||!stdout.trim())return null;
  let successfulResult=null;
  let finalAssistantText=null;
  for(const raw of stdout.split('\n')){
    const line=raw.trim();if(!line)continue;
    let value;try{value=JSON.parse(line);}catch{continue;}
    if(value?.type==='result'&&value?.is_error!==true&&value?.subtype!=='error'&&typeof value.result==='string'&&value.result.trim())successfulResult=value.result;
    if(value?.type==='assistant'&&Array.isArray(value?.message?.content)){
      const text=value.message.content.filter(part=>part?.type==='text'&&typeof part.text==='string').map(part=>part.text).join('');
      if(text.trim())finalAssistantText=text;
    }
  }
  return successfulResult?.trim()?successfulResult:finalAssistantText?.trim()?finalAssistantText:null;
}

function publicRecord(rec){
  return {
    executionId:rec.executionId,
    state:rec.state,
    provider:rec.provider,
    executionClass:rec.executionClass,
    providerRoutingReason:rec.providerRoutingReason,
    isOverride:Boolean(rec.isOverride),
    workPackageId:rec.workPackageId,
    repositoryIdentity:rec.repositoryIdentity,
    branch:rec.branch,
    head:rec.head,
    instructionSha256:rec.instructionSha256,
    dryRun:Boolean(rec.dryRun),
    pid:rec.pid??null,
    exitCode:rec.exitCode??null,
    error:rec.error??null,
    queuedAt:rec.queuedAt??null,
    startedAt:rec.startedAt??null,
    completedAt:rec.completedAt??null,
    resultContent:rec.state==='COMPLETED'?rec.resultContent??null:null,
    resultContentSha256:rec.state==='COMPLETED'?rec.resultContentSha256??null:null
  };
}
function canonicalBinding(rec){
  return [rec.provider,rec.executionClass,rec.workPackageId,rec.repositoryIdentity,rec.branch,rec.head,rec.instructionSha256,Boolean(rec.dryRun)];
}
function sameBinding(rec,candidate){return canonicalBinding(rec).every((value,index)=>value===canonicalBinding(candidate)[index]);}

export function createRemoteRunnerService(allowedRoot,options={}){
  const spawn_=options.spawn||nodeSpawn;
  const executions=new Map();
  const leases=new Map();
  const stateRoot=typeof options.stateRoot==='string'&&options.stateRoot.trim()?options.stateRoot.trim():null;
  if(stateRoot)mkdirSync(stateRoot,{recursive:true,mode:0o700});
  const recordPath=id=>stateRoot?join(stateRoot,`${encodeURIComponent(id)}.json`):null;
  const persist=rec=>{if(stateRoot)atomicJson(recordPath(rec.executionId),publicRecord(rec));};
  const isActive=state=>ACTIVE_STATES.has(state);

  if(stateRoot){
    for(const name of readdirSync(stateRoot)){
      if(!name.endsWith('.json'))continue;
      try{
        const value=JSON.parse(readFileSync(join(stateRoot,name),'utf8'));
        if(!value||typeof value.executionId!=='string'||!PUBLIC_STATES.has(value.state))continue;
        const rec={...value,_remoteRepositoryRoot:null,_instruction:null,_escalationEvidence:null};
        if(isActive(rec.state)){
          rec.state='UNCERTAIN';rec.error='REMOTE_RUNNER_RESTART_UNCERTAIN';rec.pid=null;rec.completedAt=new Date().toISOString();
          persist(rec);
        }
        executions.set(rec.executionId,rec);
      }catch{}
    }
  }

  function claimLease(rec){
    const key=leaseKey(rec.repositoryIdentity,rec.branch);
    const existing=leases.get(key);
    if(existing&&isActive(executions.get(existing)?.state))fail('REMOTE_RUNNER_WORKTREE_BUSY');
    leases.set(key,rec.executionId);
  }
  function releaseLease(rec){
    const key=leaseKey(rec.repositoryIdentity,rec.branch);
    if(leases.get(key)===rec.executionId)leases.delete(key);
  }

  async function run(rec){
    const env=buildGovernanceEnv(rec);
    const args=rec.dryRun
      ?['-p',`AICC DRY RUN CANARY — governance check only, no task execution. Work Package: ${rec.workPackageId}`,'--output-format','stream-json','--verbose']
      :['-p',rec._instruction,'--permission-mode','acceptEdits','--output-format','stream-json','--verbose'];
    rec.state='RUNNING';rec.startedAt=new Date().toISOString();persist(rec);
    let child;
    try{child=spawn_(CLAUDE_BIN,args,{cwd:rec._remoteRepositoryRoot,env});}
    catch{rec.state='FAILED';rec.error='REMOTE_RUNNER_SPAWN_FAILED';rec.completedAt=new Date().toISOString();persist(rec);releaseLease(rec);return;}
    rec.pid=child.pid??null;persist(rec);
    let stdout='';let stderr='';
    child.stdout?.on('data',chunk=>stdout+=String(chunk));
    child.stderr?.on('data',chunk=>stderr+=String(chunk));
    let code;try{[code]=await once(child,'close');}catch{code=null;}
    rec.exitCode=Number.isInteger(code)?code:null;
    if(code===0){
      const content=rec.dryRun
        ?extractDryRunEvidence(stdout,rec.workPackageId,rec.executionClass)
        :extractClaudeFinalResult(stdout);
      const changed=rec.dryRun||rec.executionClass!=='CODE_CHANGE'||Boolean(safeExec('git',['-C',rec._remoteRepositoryRoot,'status','--porcelain']));
      if(content&&changed){rec.state='COMPLETED';rec.resultContent=content;rec.resultContentSha256=sha256(content);rec.error=null;}
      else if(content&&!changed){rec.state='FAILED';rec.error='REMOTE_RUNNER_NO_CHANGE';}
      else{rec.state='FAILED';rec.error='REMOTE_RUNNER_RESULT_INVALID';}
    }else{rec.state='FAILED';rec.error='REMOTE_RUNNER_PROCESS_FAILED';}
    rec.pid=null;rec.completedAt=new Date().toISOString();persist(rec);releaseLease(rec);
    // Raw stdout/stderr are intentionally never stored on rec/persistence/public API.
    void stderr;
  }

  function submit(input){
    const decision=validateProviderDecision({executionClass:input?.executionClass,provider:input?.provider||'CLAUDE_CODE',providerRoutingReason:input?.providerRoutingReason});
    if(decision.provider!=='CLAUDE_CODE')fail('REMOTE_RUNNER_PROVIDER_INVALID');
    if(typeof input?.workPackageId!=='string'||!input.workPackageId.trim())fail('REMOTE_RUNNER_ENVELOPE_INVALID');
    if(!input?.dryRun&&(typeof input?.instruction!=='string'||!input.instruction.trim()))fail('REMOTE_RUNNER_ENVELOPE_INVALID');
    const instruction=input?.dryRun?'':String(input?.instruction||'').trim();
    const repositoryIdentity=normalizeRepositoryIdentity(input?.repositoryIdentity);
    const branch=typeof input?.expectedBranch==='string'?input.expectedBranch.trim():'';
    const head=typeof input?.expectedHead==='string'?input.expectedHead.trim():'';
    if(!repositoryIdentity)fail('REMOTE_RUNNER_IDENTITY_MISSING');if(!branch)fail('REMOTE_RUNNER_BRANCH_MISSING');if(!head)fail('REMOTE_RUNNER_HEAD_MISSING');
    const executionId=input?.executionId==null?(options.uuid||randomUUID)():String(input.executionId).trim();
    if(!executionId||executionId.length>240)fail('REMOTE_RUNNER_EXECUTION_ID_INVALID');
    const candidate={executionId,provider:'CLAUDE_CODE',executionClass:decision.executionClass,providerRoutingReason:decision.providerRoutingReason,isOverride:decision.isOverride,workPackageId:input.workPackageId.trim(),repositoryIdentity,branch,head,instructionSha256:sha256(instruction),dryRun:Boolean(input?.dryRun)};
    const existing=executions.get(executionId);
    if(existing){if(!sameBinding(existing,candidate))fail('REMOTE_RUNNER_EXECUTION_CONFLICT');return publicRecord(existing);}
    const validated=validateEnvelope(input,allowedRoot);
    const rec={...candidate,repositoryIdentity:validated.repositoryIdentity,branch:validated.expectedBranch,head:validated.expectedHead,pid:null,exitCode:null,error:null,queuedAt:new Date().toISOString(),startedAt:null,completedAt:null,resultContent:null,resultContentSha256:null,_remoteRepositoryRoot:validated.realRoot,_instruction:instruction,_escalationEvidence:input?.escalationEvidence||null};
    executions.set(executionId,rec);claimLease(rec);persist(rec);void run(rec);return publicRecord(rec);
  }

  function get(executionId){const rec=executions.get(executionId);return rec?publicRecord(rec):null;}
  function status(){
    const active=[...executions.values()].filter(rec=>isActive(rec.state));
    return {ready:true,claudeBin:CLAUDE_BIN,activeCount:active.length,activeLeases:active.map(rec=>({executionId:rec.executionId,repositoryIdentity:rec.repositoryIdentity,branch:rec.branch,head:rec.head}))};
  }
  function health(){return {ok:true,provider:'REMOTE_CLAUDE',claudeBin:CLAUDE_BIN};}
  function isLeasedByIdentity(repositoryIdentity,branch){
    const id=leases.get(leaseKey(normalizeRepositoryIdentity(repositoryIdentity)||'',branch));
    return Boolean(id&&isActive(executions.get(id)?.state));
  }
  return {submit,get,status,health,isLeasedByIdentity};
}
