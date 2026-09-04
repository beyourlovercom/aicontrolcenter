import {createHash,randomUUID} from 'node:crypto';
import {existsSync,linkSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {readRun,readRunEvents,runDir} from './run-store.mjs';

export const RESULT_SCHEMA='aicc.v3.result.v1';

function fail(code,detail=''){
  const error=new Error(detail?`${code}: ${detail}`:code);error.code=code;throw error;
}
function sha256(value){return createHash('sha256').update(value,'utf8').digest('hex');}
function boundRun(context,runId,env){
  try{return readRun(context,runId,env);}
  catch(error){
    if(error?.code==='RUN_PROJECT_MISMATCH')fail('RESULT_PROJECT_MISMATCH');
    if(error?.code==='RUN_NOT_FOUND')fail('RESULT_NOT_FOUND');
    throw error;
  }
}
export function resultFile(context,runId,env=process.env){return join(runDir(context,runId,env),'result.v1.json');}

function canonicalSource(context,run,env){
  let events;
  try{events=readRunEvents(context,run.runId,0,env);}
  catch{fail('RESULT_SOURCE_EVENT_INVALID');}
  const exits=events.filter(event=>event.type==='PROCESS_EXITED'&&event.source==='EXECUTOR_WORKER');
  if(exits.length!==1)fail('RESULT_SOURCE_EVENT_INVALID');
  const exitEvent=exits[0];
  let source=null;let parsed=null;
  for(const event of events){
    if(event.seq>=exitEvent.seq)break;
    if(event.type!=='CODEX_STDOUT'||event.source!=='CODEX'||typeof event.payload?.raw!=='string')continue;
    let value;try{value=JSON.parse(event.payload.raw);}catch{continue;}
    if(value?.type==='item.completed'&&value?.item?.type==='agent_message'&&typeof value.item.text==='string'){
      source=event;parsed=value;
    }
  }
  if(!source)fail('RESULT_SOURCE_NOT_FOUND');
  return {source,content:parsed.item.text};
}
function deterministicResultId(runId){return `result:${runId}`;}
function candidateFrom(context,run,env,now){
  if(run.state!=='EXITED')fail('RESULT_NOT_READY');
  const {source,content}=canonicalSource(context,run,env);
  const raw=source.payload.raw;
  return {
    schema:RESULT_SCHEMA,resultId:deterministicResultId(run.runId),runId:run.runId,
    taskId:run.taskId,workPackageId:run.workPackageId,
    projectId:run.projectId,repositoryIdentity:run.repositoryIdentity,repositoryPath:run.repositoryPath,
    branchAtStart:run.branchAtStart,headAtStart:run.headAtStart,dirtyAtStart:run.dirtyAtStart,
    runState:'EXITED',exitCode:run.exitCode,codexSessionId:run.codexSessionId??null,
    sourceEventSeq:source.seq,sourceEventType:'CODEX_STDOUT',sourceRawSha256:sha256(raw),
    content,contentSha256:sha256(content),createdAt:now()
  };
}
function immutableFields(result){
  const {createdAt,...rest}=result;return rest;
}
function sameCanonical(left,right){return JSON.stringify(immutableFields(left))===JSON.stringify(immutableFields(right));}
function validateResultShape(result){
  if(!result||result.schema!==RESULT_SCHEMA||typeof result.resultId!=='string'||typeof result.runId!=='string')fail('RESULT_INVALID');
  if(typeof result.content!=='string'||typeof result.contentSha256!=='string'||!Number.isInteger(result.sourceEventSeq)||result.sourceEventSeq<1)fail('RESULT_INVALID');
  if(result.sourceEventType!=='CODEX_STDOUT'||typeof result.sourceRawSha256!=='string'||typeof result.createdAt!=='string')fail('RESULT_INVALID');
  return result;
}
function validateAgainstRunAndSource(context,result,run,env){
  const exact=['runId','taskId','workPackageId','projectId','repositoryIdentity','repositoryPath','branchAtStart','headAtStart','dirtyAtStart'];
  for(const key of exact){if(result[key]!==run[key])fail('RESULT_RUN_MISMATCH');}
  if(result.runState!=='EXITED'||run.state!=='EXITED'||result.exitCode!==run.exitCode||(result.codexSessionId??null)!==(run.codexSessionId??null))fail('RESULT_RUN_MISMATCH');
  if(result.resultId!==deterministicResultId(run.runId))fail('RESULT_INVALID');
  if(result.contentSha256!==sha256(result.content))fail('RESULT_INVALID');
  const expected=candidateFrom(context,run,env,()=>result.createdAt);
  if(!sameCanonical(result,expected))fail('RESULT_SOURCE_EVENT_INVALID');
  return result;
}
export function readResult(context,runId,env=process.env){
  const run=boundRun(context,runId,env);const path=resultFile(context,runId,env);
  if(!existsSync(path))fail('RESULT_NOT_FOUND');
  let result;try{result=JSON.parse(readFileSync(path,'utf8'));}catch{fail('RESULT_INVALID');}
  return validateAgainstRunAndSource(context,validateResultShape(result),run,env);
}
export function materializeResult(context,runId,env=process.env,options={}){
  const run=boundRun(context,runId,env);const now=options.now||(()=>new Date().toISOString());
  const candidate=candidateFrom(context,run,env,now);const path=resultFile(context,runId,env);
  if(existsSync(path)){
    const existing=readResult(context,runId,env);
    if(!sameCanonical(existing,candidate))fail('RESULT_CONFLICT');
    return existing;
  }
  const temp=`${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temp,`${JSON.stringify(candidate,null,2)}\n`,{encoding:'utf8',flag:'wx'});
  try{
    linkSync(temp,path);
  }catch(error){
    if(error?.code==='EEXIST'){
      const existing=readResult(context,runId,env);
      if(sameCanonical(existing,candidate))return existing;
      fail('RESULT_CONFLICT');
    }
    throw error;
  }finally{try{rmSync(temp);}catch{}}
  return readResult(context,runId,env);
}
export function readOrMaterializeResult(context,runId,env=process.env,options={}){
  try{return readResult(context,runId,env);}catch(error){
    if(error?.code!=='RESULT_NOT_FOUND')throw error;
  }
  return materializeResult(context,runId,env,options);
}
