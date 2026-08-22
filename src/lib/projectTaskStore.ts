import {closeSync,existsSync,mkdirSync,openSync,readFileSync,renameSync,statSync,unlinkSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {resolveAiccStateDir} from './stateDirectory.ts';
import type {CanonicalExecutionResult,ReturnState} from './model/entityTypes.ts';
import type {ProjectIdentityScope} from './projectEntityScope.ts';

export type ProjectTaskRunRecord={
  runId:string;
  executionId:string;
  instructionId:string;
  status:string;
  executionProvider?:'LOCAL_CODEX'|'REMOTE_CLAUDE';
  provider?:string;
  model?:string;
  reasoning?:string;
  startedAt?:string;
  completedAt?:string;
  exitCode?:number|null;
  resultAvailability:'AVAILABLE'|'NOT_AVAILABLE';
  canonicalResult?:CanonicalExecutionResult;
};

export type ProjectTaskStoreRecord={
  registryVersion?:2;
  recordType?:'CANONICAL_TASK';
  taskId:string;
  inboxId:string;
  instructionId:string;
  projectId:string;
  repositoryIdentity:string;
  repositoryPath?:string;
  rawInstruction:string;
  status:string;
  createdAt:string;
  updatedAt:string;
  executionId?:string;
  runId?:string;
  latestRunId?:string;
  runs?:ProjectTaskRunRecord[];
  resultAvailability?:'AVAILABLE'|'NOT_AVAILABLE';
  canonicalResult?:CanonicalExecutionResult;
  resultId?:string|null;
  resultHash?:string|null;
  instruction?:Record<string,unknown>;
  [key:string]:unknown;
};type RuntimeTaskEvidence={
  projectId:string;repositoryIdentity:string;repositoryPath?:string;runId:string;
  taskId?:string;inboxId?:string;instructionId?:string;instructionText?:string;
  instructionSourceType?:string;entityType?:'global_task'|'work_package'|'pull_request';
  entityId?:string;workPackageId?:string|null;parentWorkPackageId?:string;
  branch?:string;startingHeadSha?:string;executionType?:string;sandboxMode?:string;
  executionProvider?:'LOCAL_CODEX'|'REMOTE_CLAUDE';provider?:string;
  resolvedModel?:string;model?:string;reasoningLevel?:string;phase:string;
  startedAt?:string;completedAt?:string;lastActivityAt?:string;exitCode?:number|null;
  canonicalResult?:CanonicalExecutionResult;
};

type EnsureTaskBeforeRunInput=RuntimeTaskEvidence&{createdAt?:string};
const ROOT=resolveAiccStateDir();
const LEGACY_TASK_FILE=join(ROOT,'task-registry.json');
const sleepBuffer=new Int32Array(new SharedArrayBuffer(4));

function safeSegment(value:string,label:string){
  const normalized=String(value??'').trim();
  if(!normalized||!/^[A-Za-z0-9._-]+$/.test(normalized))throw new Error(`${label}_INVALID`);
  return normalized;
}
export function projectStateRoot(scope:ProjectIdentityScope){return join(ROOT,'projects',safeSegment(scope.projectId,'PROJECT_ID'))}
export function projectTaskDirectory(scope:ProjectIdentityScope){return join(projectStateRoot(scope),'tasks')}
export function projectTaskRegistryPath(scope:ProjectIdentityScope){return join(projectTaskDirectory(scope),'task-registry.json')}
export function projectTaskProjectionPath(scope:ProjectIdentityScope){return join(projectTaskDirectory(scope),'task-projection.json')}
export function projectRunLedgerDirectory(scope:ProjectIdentityScope,runId:string){return join(projectStateRoot(scope),'runs',safeSegment(runId,'RUN_ID'))}
export function projectRunLedgerPath(scope:ProjectIdentityScope,runId:string){return join(projectRunLedgerDirectory(scope,runId),'run.json')}
export function projectRunFinalMessagePath(scope:ProjectIdentityScope,runId:string){return join(projectRunLedgerDirectory(scope,runId),'final-message.txt')}
function readJson<T>(file:string,fallback:T):T{try{return JSON.parse(readFileSync(file,'utf8')) as T}catch{return fallback}}
function atomicWrite(file:string,value:unknown){
  mkdirSync(dirname(file),{recursive:true});
  const tmp=`${file}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp,JSON.stringify(value,null,2),{mode:0o600});
  renameSync(tmp,file);
}
function withRegistryLock<T>(scope:ProjectIdentityScope,work:()=>T):T{
  const directory=projectTaskDirectory(scope);mkdirSync(directory,{recursive:true});
  const lock=join(directory,'.task-registry.lock'),deadline=Date.now()+3_000;
  while(true){
    try{const fd=openSync(lock,'wx',0o600);try{writeFileSync(fd,`${process.pid}\n${Date.now()}\n`);return work()}finally{closeSync(fd);try{unlinkSync(lock)}catch{}}}
    catch(error:any){
      if(error?.code!=='EEXIST')throw error;
      try{if(Date.now()-statSync(lock).mtimeMs>30_000)unlinkSync(lock)}catch{}
      if(Date.now()>=deadline)throw new Error('TASK_REGISTRY_LOCK_TIMEOUT');
      Atomics.wait(sleepBuffer,0,0,10);
    }
  }
}
function recordScope(record:ProjectTaskStoreRecord){return {projectId:record.projectId,repositoryIdentity:record.repositoryIdentity}}
function sameScope(record:ProjectTaskStoreRecord,scope:ProjectIdentityScope){return record.projectId===scope.projectId&&record.repositoryIdentity===scope.repositoryIdentity}
function taskKey(record:ProjectTaskStoreRecord){return `${record.projectId}\x00${record.repositoryIdentity}\x00${record.taskId}`}
function runStatus(value:unknown){return String(value??'UNKNOWN').toUpperCase()}
function runFromTopLevel(record:ProjectTaskStoreRecord):ProjectTaskRunRecord|null{
  if(!record.runId)return null;
  return {runId:record.runId,executionId:record.executionId??record.runId,instructionId:record.instructionId,status:runStatus(record.status),resultAvailability:record.canonicalResult?'AVAILABLE':'NOT_AVAILABLE',canonicalResult:record.canonicalResult,startedAt:record.startedAt as string|undefined,completedAt:record.completedAt as string|undefined};
}
function normalizedRuns(record:ProjectTaskStoreRecord):ProjectTaskRunRecord[]{
  const runs=Array.isArray(record.runs)?record.runs.filter(run=>run&&typeof run.runId==='string'):[];
  const legacy=runFromTopLevel(record);
  if(legacy&&!runs.some(run=>run.runId===legacy.runId))runs.push(legacy);
  return runs;
}
function assertResultImmutable(previous?:CanonicalExecutionResult,current?:CanonicalExecutionResult){
  if(!previous||!current)return;
  if(previous.resultId!==current.resultId||previous.resultHash!==current.resultHash||previous.rawResult!==current.rawResult)throw new Error('CANONICAL_RESULT_IMMUTABLE');
}
function mergeRecords(primary:ProjectTaskStoreRecord[],legacy:ProjectTaskStoreRecord[]){
  const byKey=new Map<string,ProjectTaskStoreRecord>();
  for(const record of legacy)byKey.set(taskKey(record),record);
  for(const record of primary)byKey.set(taskKey(record),record);
  return [...byKey.values()].sort((a,b)=>Date.parse(b.createdAt||'')-Date.parse(a.createdAt||''));
}
function readLegacyRecords(scope:ProjectIdentityScope){return readJson<ProjectTaskStoreRecord[]>(LEGACY_TASK_FILE,[]).filter(record=>record&&sameScope(record,scope))}
export function readProjectTaskRecords<T extends ProjectTaskStoreRecord=ProjectTaskStoreRecord>(scope:ProjectIdentityScope):T[]{
  const file=projectTaskRegistryPath(scope),primary=readJson<ProjectTaskStoreRecord[]>(file,[]).filter(record=>record&&sameScope(record,scope)),legacy=readLegacyRecords(scope),merged=mergeRecords(primary,legacy);
  if((!existsSync(file)&&merged.length)||merged.length>primary.length)withRegistryLock(scope,()=>atomicWrite(file,merged));
  return merged as T[];
}
export function writeProjectTaskRecords<T extends ProjectTaskStoreRecord>(scope:ProjectIdentityScope,records:T[]):T[]{
  const normalized=records.filter(record=>sameScope(record,scope));
  return withRegistryLock(scope,()=>{atomicWrite(projectTaskRegistryPath(scope),normalized);return normalized});
}
function definedRecordFields<T extends Record<string,unknown>>(value:T){return Object.fromEntries(Object.entries(value).filter(([,item])=>item!==undefined)) as Partial<T>}
function mergeTaskStoreRecords(previous:ProjectTaskStoreRecord|undefined,incoming:ProjectTaskStoreRecord):ProjectTaskStoreRecord{
  if(!previous)return incoming;
  if(previous.taskId!==incoming.taskId||!sameScope(previous,recordScope(incoming)))throw new Error('TASK_IDENTITY_MISMATCH');
  const byRun=new Map<string,ProjectTaskRunRecord>();
  for(const run of normalizedRuns(previous))byRun.set(run.runId,run);
  for(const next of normalizedRuns(incoming)){const prior=byRun.get(next.runId);assertResultImmutable(prior?.canonicalResult,next.canonicalResult);byRun.set(next.runId,{...prior,...definedRecordFields(next),canonicalResult:next.canonicalResult??prior?.canonicalResult,resultAvailability:next.canonicalResult||prior?.canonicalResult?'AVAILABLE':'NOT_AVAILABLE'})}
  const runs=[...byRun.values()];
  const latestRunId=incoming.latestRunId??incoming.runId??previous.latestRunId??previous.runId;
  const latestRun=latestRunId?runs.find(run=>run.runId===latestRunId):undefined;
  const latestResult=latestRun?.canonicalResult;
  assertResultImmutable(previous.canonicalResult,latestRunId===(previous.latestRunId??previous.runId)?latestResult:undefined);
  const merged={...previous,...definedRecordFields(incoming),instruction:{...(previous.instruction??{}),...(incoming.instruction??{})},createdAt:previous.createdAt,runs,latestRunId,canonicalResult:latestResult,resultAvailability:latestResult?'AVAILABLE':'NOT_AVAILABLE',resultId:latestResult?.resultId??null,resultHash:latestResult?.resultHash??null} as ProjectTaskStoreRecord;
  return merged;
}
export function upsertProjectTaskRecord<T extends ProjectTaskStoreRecord>(record:T):T{
  const scope=recordScope(record);
  return withRegistryLock(scope,()=>{
    const records=mergeRecords(readJson<ProjectTaskStoreRecord[]>(projectTaskRegistryPath(scope),[]).filter(item=>sameScope(item,scope)),readLegacyRecords(scope));
    const previous=records.find(item=>item.taskId===record.taskId);
    const merged=mergeTaskStoreRecords(previous,record);
    if(previous&&JSON.stringify(previous)===JSON.stringify(merged))return merged as T;
    const next=[merged,...records.filter(item=>item.taskId!==record.taskId)].sort((a,b)=>Date.parse(b.createdAt||'')-Date.parse(a.createdAt||''));
    atomicWrite(projectTaskRegistryPath(scope),next);return merged as T;
  });
}
function entityScope(entityType?:RuntimeTaskEvidence['entityType']){return entityType==='work_package'?'WORK_PACKAGE':entityType==='pull_request'?'PULL_REQUEST':'GLOBAL_TASK'}
function entityTypeUpper(entityType?:RuntimeTaskEvidence['entityType']){return entityType==='work_package'?'WORK_PACKAGE':entityType==='pull_request'?'PULL_REQUEST':'GLOBAL_TASK'}
function buildSyntheticInstruction(input:EnsureTaskBeforeRunInput,instructionId:string){
  const entityId=input.entityId??(input.entityType==='global_task'?'GLOBAL_TASK':input.workPackageId??'GLOBAL_TASK');
  const workPackageId=input.workPackageId??(input.entityType==='work_package'?entityId:input.parentWorkPackageId??null);
  return {version:'AICC_EXECUTION_V1',instructionId,entityType:entityTypeUpper(input.entityType),entityId,workPackageId,prId:input.entityType==='pull_request'?entityId:null,entityScope:entityScope(input.entityType),displayBinding:input.entityType==='work_package'?'WORK_PACKAGE':input.entityType==='pull_request'?'PULL_REQUEST':'GLOBAL / UNMAPPED',executionType:input.executionType??'IMPLEMENTATION',repository:input.repositoryPath??'NOT_AVAILABLE',repositoryPath:input.repositoryPath,branch:input.branch??'NOT_AVAILABLE',expectedHead:input.startingHeadSha??'NOT_AVAILABLE',sandbox:input.sandboxMode??'workspace-write',requiresAuthorization:false,instructionBody:input.instructionText??'',rawInstruction:input.instructionText??'',sourceType:input.instructionSourceType??'AICC_RUNTIME',ownerDirectExecution:false,receivedAt:input.createdAt??input.startedAt??new Date().toISOString(),projectId:input.projectId,repositoryIdentity:input.repositoryIdentity};
}
function mergeRun(record:ProjectTaskStoreRecord,evidence:RuntimeTaskEvidence):ProjectTaskStoreRecord{
  const runs=normalizedRuns(record),previous=runs.find(run=>run.runId===evidence.runId);
  assertResultImmutable(previous?.canonicalResult,evidence.canonicalResult);
  const run:ProjectTaskRunRecord={...previous,runId:evidence.runId,executionId:evidence.runId,instructionId:evidence.instructionId??previous?.instructionId??record.instructionId,status:runStatus(evidence.phase),executionProvider:evidence.executionProvider??previous?.executionProvider,provider:evidence.provider??previous?.provider,model:evidence.resolvedModel??evidence.model??previous?.model,reasoning:evidence.reasoningLevel??previous?.reasoning,startedAt:evidence.startedAt??previous?.startedAt,completedAt:evidence.completedAt??previous?.completedAt,exitCode:evidence.exitCode??previous?.exitCode,resultAvailability:evidence.canonicalResult||previous?.canonicalResult?'AVAILABLE':'NOT_AVAILABLE',canonicalResult:evidence.canonicalResult??previous?.canonicalResult};
  const nextRuns=[...runs.filter(item=>item.runId!==run.runId),run];
  const result=run.canonicalResult,changed=!previous||JSON.stringify(previous)!==JSON.stringify(run)||record.runId!==run.runId||record.status!==run.status;
  return {...record,executionId:run.executionId,runId:run.runId,latestRunId:run.runId,runs:nextRuns,status:run.status,updatedAt:changed?(evidence.completedAt??evidence.lastActivityAt??new Date().toISOString()):record.updatedAt,startedAt:run.startedAt,completedAt:run.completedAt,resultAvailability:result?'AVAILABLE':'NOT_AVAILABLE',canonicalResult:result,resultId:result?.resultId??null,resultHash:result?.resultHash??null};
}
export function ensureTaskBeforeRun(input:EnsureTaskBeforeRunInput):ProjectTaskStoreRecord{
  const scope={projectId:input.projectId,repositoryIdentity:input.repositoryIdentity},taskId=input.taskId??`task-${input.runId}`,inboxId=input.inboxId??`runtime-${input.runId}`,instructionId=input.instructionId??`instruction-${input.runId}`,now=input.createdAt??input.startedAt??new Date().toISOString();
  const existing=readProjectTaskRecords(scope).find(record=>record.taskId===taskId||normalizedRuns(record).some(run=>run.runId===input.runId));
  const base:ProjectTaskStoreRecord=existing??{registryVersion:2,recordType:'CANONICAL_TASK',taskId,inboxId,instructionId,projectId:scope.projectId,repositoryIdentity:scope.repositoryIdentity,repositoryPath:input.repositoryPath,rawInstruction:input.instructionText??'',status:runStatus(input.phase),createdAt:now,updatedAt:now,entityScope:entityScope(input.entityType),workPackageId:input.workPackageId??null,prId:input.entityType==='pull_request'?(input.entityId??null):null,repository:input.repositoryPath??'NOT_AVAILABLE',branch:input.branch??'NOT_AVAILABLE',origin:input.instructionSourceType??'AICC_RUNTIME',instruction:buildSyntheticInstruction(input,instructionId)};
  const withIdentity={...base,taskId,inboxId:existing?.inboxId??inboxId,instructionId:existing?.instructionId??instructionId,projectId:scope.projectId,repositoryIdentity:scope.repositoryIdentity,repositoryPath:input.repositoryPath??base.repositoryPath,rawInstruction:base.rawInstruction||input.instructionText||'',instruction:base.instruction??buildSyntheticInstruction(input,instructionId)};
  const record=mergeRun(withIdentity,input);
  upsertProjectTaskRecord(record);
  writeRunLedger(record,input.runId);
  return record;
}

export function persistRuntimeTaskState(evidence:RuntimeTaskEvidence):ProjectTaskStoreRecord{
  const scope={projectId:evidence.projectId,repositoryIdentity:evidence.repositoryIdentity};
  const existing=readProjectTaskRecords(scope).find(record=>record.taskId===evidence.taskId||normalizedRuns(record).some(run=>run.runId===evidence.runId));
  const record=existing?mergeRun(existing,evidence):ensureTaskBeforeRun({...evidence,taskId:evidence.taskId,inboxId:evidence.inboxId});
  if(existing&&JSON.stringify(existing)!==JSON.stringify(record)){upsertProjectTaskRecord(record);writeRunLedger(record,evidence.runId)}
  return record;
}

export function readProjectTaskByRun<T extends ProjectTaskStoreRecord=ProjectTaskStoreRecord>(scope:ProjectIdentityScope,runId:string):T|null{
  return (readProjectTaskRecords(scope).find(record=>record.runId===runId||record.latestRunId===runId||normalizedRuns(record).some(run=>run.runId===runId))??null) as T|null;
}
export function readProjectTaskById<T extends ProjectTaskStoreRecord=ProjectTaskStoreRecord>(scope:ProjectIdentityScope,taskId:string):T|null{
  return (readProjectTaskRecords(scope).find(record=>record.taskId===taskId)??null) as T|null;
}
export function readProjectTaskResult(scope:ProjectIdentityScope,runId:string){
  const task=readProjectTaskByRun(scope,runId);if(!task)return null;
  const run=normalizedRuns(task).find(item=>item.runId===runId)??null;
  const canonicalResult=run?.canonicalResult??(task.runId===runId?task.canonicalResult:undefined)??null;
  return {task,run,canonicalResult};
}

export function updateProjectTaskResultDelivery(scope:ProjectIdentityScope,runId:string,update:Partial<Pick<CanonicalExecutionResult,'returnState'|'returnAttemptedAt'|'returnedAt'|'returnFailure'>>,expected?:{resultId?:string;resultHash?:string}){
  const task=readProjectTaskByRun(scope,runId);if(!task)return null;
  const runs=normalizedRuns(task),index=runs.findIndex(run=>run.runId===runId);if(index<0)return null;
  const current=runs[index].canonicalResult;if(!current)return null;
  if(expected?.resultId&&current.resultId!==expected.resultId)return null;
  if(expected?.resultHash&&current.resultHash!==expected.resultHash)return null;
  const nextResult={...current,...update};assertResultImmutable(current,nextResult);
  runs[index]={...runs[index],canonicalResult:nextResult,resultAvailability:'AVAILABLE'};
  const latest=task.latestRunId??task.runId,next={...task,runs,updatedAt:new Date().toISOString(),...(latest===runId?{canonicalResult:nextResult,resultAvailability:'AVAILABLE' as const,resultId:nextResult.resultId,resultHash:nextResult.resultHash}:{})};
  upsertProjectTaskRecord(next);writeRunLedger(next,runId);return nextResult;
}

export function writeRunLedger(task:ProjectTaskStoreRecord,runId:string){
  const scope=recordScope(task),run=normalizedRuns(task).find(item=>item.runId===runId);if(!run)return null;
  const file=projectRunLedgerPath(scope,runId),previous=readJson<any>(file,null);
  if(previous?.canonicalResult&&run.canonicalResult)assertResultImmutable(previous.canonicalResult,run.canonicalResult);
  const ledger={schema:'aicc.project-run-ledger.v1',projectId:task.projectId,repositoryIdentity:task.repositoryIdentity,repositoryPath:task.repositoryPath??null,taskId:task.taskId,inboxId:task.inboxId,instructionId:run.instructionId,runId,executionId:run.executionId,instruction:{rawInstruction:task.rawInstruction},run:{...run,canonicalResult:undefined},canonicalResult:run.canonicalResult??null,createdAt:previous?.createdAt??run.startedAt??task.createdAt,updatedAt:new Date().toISOString()};
  atomicWrite(file,ledger);return ledger;
}

export function migrateLegacyTaskRegistry(){
  const legacy=readJson<ProjectTaskStoreRecord[]>(LEGACY_TASK_FILE,[]),scopes=new Map<string,ProjectIdentityScope>();
  for(const record of legacy)if(record?.projectId&&record?.repositoryIdentity)scopes.set(`${record.projectId}\x00${record.repositoryIdentity}`,{projectId:record.projectId,repositoryIdentity:record.repositoryIdentity});
  const migrated:{projectId:string;count:number;path:string}[]=[];
  for(const scope of scopes.values()){const records=readProjectTaskRecords(scope);if(records.length)migrated.push({projectId:scope.projectId,count:records.length,path:projectTaskRegistryPath(scope)})}
  return migrated;
}
