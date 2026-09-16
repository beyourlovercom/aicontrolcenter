import {createHash,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {appendFileSync,chmodSync,existsSync,linkSync,mkdirSync,readFileSync,readdirSync,renameSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {stateRoot} from './project-context.mjs';
import {projectBinding} from './work-store.mjs';

export const BRIDGE_REQUEST_SCHEMA='aicc.v3.bridge-request.v1';
export const BRIDGE_STATE_SCHEMA='aicc.v3.bridge-state.v1';
export const BRIDGE_EVENT_SCHEMA='aicc.v3.bridge-event.v1';
export const BRIDGE_DELIVERY_SCHEMA='aicc.v3.bridge-delivery.v1';
export const BRIDGE_RECEIPT_SCHEMA='aicc.v3.bridge-receipt.v1';
export const BRIDGE_PROVIDER_EXECUTION_SCHEMA='aicc.v3.bridge-provider-execution.v1';
export const BRIDGE_PROVIDER_RESULT_SCHEMA='aicc.v3.bridge-provider-result.v1';
export const BRIDGE_CREDENTIAL_SCHEMA='aicc.v3.bridge-credential.v1';
export const DELIVERY_STATES=Object.freeze(['WAITING_RESULT','READY','CLAIMED','DELIVERED','DELIVERY_UNCERTAIN']);

function fail(code,detail=''){const error=new Error(detail?`${code}: ${detail}`:code);error.code=code;throw error;}
function atomicJson(path,value){
  mkdirSync(dirname(path),{recursive:true});const temp=`${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temp,`${JSON.stringify(value,null,2)}\n`,{encoding:'utf8',flag:'wx'});renameSync(temp,path);
}
function createOnceJson(path,value,conflictCode){
  mkdirSync(dirname(path),{recursive:true});const temp=`${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temp,`${JSON.stringify(value,null,2)}\n`,{encoding:'utf8',flag:'wx'});
  try{linkSync(temp,path);return value;}catch(error){if(error?.code!=='EEXIST')throw error;fail(conflictCode);}finally{try{rmSync(temp);}catch{}}
}
function sameRepositoryPath(a,b){
  if(typeof a!=='string'||typeof b!=='string')return false;
  try{const x=statSync(a),y=statSync(b);return x.dev===y.dev&&x.ino===y.ino;}catch{return a===b;}
}
function projectMatches(value,context){
  const project=projectBinding(context);
  return value?.projectId===project.id&&value?.repositoryIdentity===project.repositoryIdentity&&sameRepositoryPath(value?.repositoryPath,context?.repository?.path);
}
export function bridgeRoot(_context,env=process.env){return join(stateRoot(env),'bridge');}
export function requestsRoot(context,env=process.env){return join(bridgeRoot(context,env),'requests');}
export function bridgeRequestDir(context,requestId,env=process.env){return join(requestsRoot(context,env),requestId);}
export function requestFile(context,requestId,env=process.env){return join(bridgeRequestDir(context,requestId,env),'request.v1.json');}
export function stateFile(context,requestId,env=process.env){return join(bridgeRequestDir(context,requestId,env),'state.v1.json');}
export function eventsFile(context,requestId,env=process.env){return join(bridgeRequestDir(context,requestId,env),'events.jsonl');}
export function deliveryFile(context,requestId,env=process.env){return join(bridgeRequestDir(context,requestId,env),'delivery.v1.json');}
export function receiptFile(context,requestId,env=process.env){return join(bridgeRequestDir(context,requestId,env),'receipt.v1.json');}
export function providerExecutionFile(context,requestId,env=process.env){return join(bridgeRequestDir(context,requestId,env),'provider-execution.v1.json');}
export function providerResultFile(context,requestId,env=process.env){return join(bridgeRequestDir(context,requestId,env),'provider-result.v1.json');}
export function credentialFile(env=process.env){return join(stateRoot(env),'bridge','credential.v1.json');}

export function ensureBridgeCredential(env=process.env,options={}){
  const path=credentialFile(env);mkdirSync(dirname(path),{recursive:true,mode:0o700});
  if(existsSync(path)){
    let value;try{value=JSON.parse(readFileSync(path,'utf8'));}catch{fail('BRIDGE_AUTH_REQUIRED');}
    if(value?.schema!==BRIDGE_CREDENTIAL_SCHEMA||typeof value.token!=='string'||value.token.length<32)fail('BRIDGE_AUTH_REQUIRED');
    try{chmodSync(path,0o600);}catch{}return value.token;
  }
  const token=options.token||randomBytes(32).toString('base64url');
  if(typeof token!=='string'||token.length<32)fail('BRIDGE_AUTH_REQUIRED');
  const value={schema:BRIDGE_CREDENTIAL_SCHEMA,token,createdAt:(options.now||(()=>new Date().toISOString()))()};
  writeFileSync(path,`${JSON.stringify(value,null,2)}\n`,{encoding:'utf8',flag:'wx',mode:0o600});
  try{chmodSync(path,0o600);}catch{}return token;
}
export function verifyBridgeCredential(candidate,env=process.env,options={}){
  if(typeof candidate!=='string'||!candidate)fail('BRIDGE_AUTH_REQUIRED');
  const expected=ensureBridgeCredential(env,options);const a=Buffer.from(candidate),b=Buffer.from(expected);
  if(a.length!==b.length||!timingSafeEqual(a,b))fail('BRIDGE_AUTH_REQUIRED');return true;
}

function validateRequestShape(value){
  if(!value||value.schema!==BRIDGE_REQUEST_SCHEMA||typeof value.requestId!=='string'||typeof value.runId!=='string')fail('BRIDGE_REQUEST_INVALID');
  if(value.provider!=='chatgpt-web'||typeof value.conversationId!=='string'||!value.conversationId||typeof value.originTurnId!=='string'||!value.originTurnId)fail('BRIDGE_REQUEST_INVALID');
  if(typeof value.taskId!=='string'||typeof value.workPackageId!=='string'||typeof value.instructionSha256!=='string'||typeof value.createdAt!=='string')fail('BRIDGE_REQUEST_INVALID');
  if(typeof value.projectId!=='string'||!value.projectId||typeof value.repositoryIdentity!=='string'||!value.repositoryIdentity||typeof value.repositoryPath!=='string'||!value.repositoryPath)fail('BRIDGE_REQUEST_INVALID');
  return value;
}
function validateRequest(value,context){validateRequestShape(value);if(!projectMatches(value,context))fail('BRIDGE_PROJECT_MISMATCH');return value;}
export function readBridgeRequestBinding(requestId,env=process.env){
  const path=requestFile(null,requestId,env);if(!existsSync(path))fail('BRIDGE_REQUEST_INVALID');
  let value;try{value=JSON.parse(readFileSync(path,'utf8'));}catch{fail('BRIDGE_REQUEST_INVALID');}
  validateRequestShape(value);return {projectId:value.projectId,repositoryIdentity:value.repositoryIdentity,repositoryPath:value.repositoryPath};
}
export function readBridgeRequest(context,requestId,env=process.env){
  const path=requestFile(context,requestId,env);if(!existsSync(path))fail('BRIDGE_REQUEST_INVALID');
  let value;try{value=JSON.parse(readFileSync(path,'utf8'));}catch{fail('BRIDGE_REQUEST_INVALID');}
  return validateRequest(value,context);
}
export function createBridgeRequest(context,value,env=process.env){
  validateRequest(value,context);const path=requestFile(context,value.requestId,env);const dir=bridgeRequestDir(context,value.requestId,env);
  if(existsSync(path))return readBridgeRequest(context,value.requestId,env);
  mkdirSync(requestsRoot(context,env),{recursive:true});
  try{mkdirSync(dir,{recursive:false});}catch(error){if(error?.code==='EEXIST'&&existsSync(path))return readBridgeRequest(context,value.requestId,env);if(error?.code==='EEXIST')fail('BRIDGE_RUN_BINDING_FAILED');throw error;}
  try{
    writeFileSync(eventsFile(context,value.requestId,env),'',{encoding:'utf8',flag:'wx'});
    const state={schema:BRIDGE_STATE_SCHEMA,requestId:value.requestId,deliveryState:'WAITING_RESULT',claimAttempts:0,safePreSendRetryCount:0,activeClaim:null,updatedAt:value.createdAt};
    atomicJson(stateFile(context,value.requestId,env),state);
    writeFileSync(path,`${JSON.stringify(value,null,2)}\n`,{encoding:'utf8',flag:'wx'});
    return readBridgeRequest(context,value.requestId,env);
  }catch(error){if(!existsSync(path))try{rmSync(dir,{recursive:true,force:true});}catch{}throw error;}
}
function validateState(value,request){
  if(!value||value.schema!==BRIDGE_STATE_SCHEMA||value.requestId!==request.requestId||!DELIVERY_STATES.includes(value.deliveryState))fail('BRIDGE_REQUEST_INVALID');
  if(!Number.isInteger(value.claimAttempts)||value.claimAttempts<0||!Number.isInteger(value.safePreSendRetryCount)||value.safePreSendRetryCount<0)fail('BRIDGE_REQUEST_INVALID');
  return value;
}
export function readBridgeState(context,requestId,env=process.env){
  const request=readBridgeRequest(context,requestId,env);const path=stateFile(context,requestId,env);if(!existsSync(path))fail('BRIDGE_REQUEST_INVALID');
  let value;try{value=JSON.parse(readFileSync(path,'utf8'));}catch{fail('BRIDGE_REQUEST_INVALID');}return validateState(value,request);
}
export function updateBridgeState(context,requestId,patch,env=process.env,options={}){
  const current=readBridgeState(context,requestId,env);const next={...current,...patch,updatedAt:(options.now||(()=>new Date().toISOString()))()};
  validateState(next,readBridgeRequest(context,requestId,env));atomicJson(stateFile(context,requestId,env),next);return next;
}
function parseEvents(path,requestId){
  if(!existsSync(path))fail('BRIDGE_REQUEST_INVALID');const text=readFileSync(path,'utf8');if(!text)return [];
  return text.split('\n').filter(Boolean).map((line,index)=>{let event;try{event=JSON.parse(line);}catch{fail('BRIDGE_REQUEST_INVALID');}
    if(event?.schema!==BRIDGE_EVENT_SCHEMA||event.requestId!==requestId||event.seq!==index+1)fail('BRIDGE_REQUEST_INVALID');return event;});
}
export function appendBridgeEvent(context,requestId,type,payload={},env=process.env,options={}){
  readBridgeRequest(context,requestId,env);const path=eventsFile(context,requestId,env);const seq=parseEvents(path,requestId).length+1;
  const event={schema:BRIDGE_EVENT_SCHEMA,seq,at:(options.now||(()=>new Date().toISOString()))(),requestId,type,payload};
  appendFileSync(path,`${JSON.stringify(event)}\n`,{encoding:'utf8'});return event;
}
export function readBridgeEvents(context,requestId,env=process.env){readBridgeRequest(context,requestId,env);return parseEvents(eventsFile(context,requestId,env),requestId);}
function validateProviderExecution(value,request){
  if(!value||value.schema!==BRIDGE_PROVIDER_EXECUTION_SCHEMA||value.requestId!==request.requestId||value.executionId!==request.runId||value.provider!=='CLAUDE_CODE')fail('BRIDGE_PROVIDER_EXECUTION_INVALID');
  if(value.taskId!==request.taskId||value.workPackageId!==request.workPackageId||value.repositoryIdentity!==request.repositoryIdentity)fail('BRIDGE_PROJECT_MISMATCH');
  if(typeof value.branch!=='string'||!value.branch||typeof value.head!=='string'||!value.head||typeof value.createdAt!=='string')fail('BRIDGE_PROVIDER_EXECUTION_INVALID');
  return value;
}
export function readProviderExecution(context,requestId,env=process.env){
  const request=readBridgeRequest(context,requestId,env);const path=providerExecutionFile(context,requestId,env);if(!existsSync(path))return null;
  let value;try{value=JSON.parse(readFileSync(path,'utf8'));}catch{fail('BRIDGE_PROVIDER_EXECUTION_INVALID');}
  return validateProviderExecution(value,request);
}
export function createProviderExecution(context,requestId,value,env=process.env){
  const request=readBridgeRequest(context,requestId,env);validateProviderExecution(value,request);const path=providerExecutionFile(context,requestId,env);
  if(existsSync(path)){const existing=readProviderExecution(context,requestId,env);if(JSON.stringify({...existing,createdAt:null})!==JSON.stringify({...value,createdAt:null}))fail('BRIDGE_REQUEST_CONFLICT');return existing;}
  createOnceJson(path,value,'BRIDGE_REQUEST_CONFLICT');return readProviderExecution(context,requestId,env);
}
function validateProviderResult(value,request){
  if(!value||value.schema!==BRIDGE_PROVIDER_RESULT_SCHEMA||value.requestId!==request.requestId||value.executionId!==request.runId||value.provider!=='CLAUDE_CODE')fail('BRIDGE_PROVIDER_RESULT_INVALID');
  if(value.taskId!==request.taskId||value.workPackageId!==request.workPackageId)fail('BRIDGE_PROJECT_MISMATCH');
  if(typeof value.resultId!=='string'||!value.resultId||typeof value.content!=='string'||!value.content||typeof value.contentSha256!=='string'||value.contentSha256!==sha256(value.content)||typeof value.createdAt!=='string')fail('BRIDGE_PROVIDER_RESULT_INVALID');
  return value;
}
export function readProviderResult(context,requestId,env=process.env){
  const request=readBridgeRequest(context,requestId,env);const path=providerResultFile(context,requestId,env);if(!existsSync(path))return null;
  let value;try{value=JSON.parse(readFileSync(path,'utf8'));}catch{fail('BRIDGE_PROVIDER_RESULT_INVALID');}
  return validateProviderResult(value,request);
}
export function createProviderResult(context,requestId,value,env=process.env){
  const request=readBridgeRequest(context,requestId,env);validateProviderResult(value,request);const path=providerResultFile(context,requestId,env);
  if(existsSync(path)){const existing=readProviderResult(context,requestId,env);if(JSON.stringify({...existing,createdAt:null})!==JSON.stringify({...value,createdAt:null}))fail('BRIDGE_REQUEST_CONFLICT');return existing;}
  createOnceJson(path,value,'BRIDGE_REQUEST_CONFLICT');return readProviderResult(context,requestId,env);
}

function validateDelivery(value,request){
  if(!value||value.schema!==BRIDGE_DELIVERY_SCHEMA||value.requestId!==request.requestId||typeof value.deliveryId!=='string'||typeof value.resultId!=='string')fail('BRIDGE_DELIVERY_NOT_FOUND');
  for(const key of ['conversationId','originTurnId','taskId','workPackageId','runId'])if(value[key]!==request[key])fail('BRIDGE_PROJECT_MISMATCH');
  if(typeof value.content!=='string'||typeof value.contentSha256!=='string'||typeof value.createdAt!=='string')fail('BRIDGE_DELIVERY_NOT_FOUND');return value;
}
export function readDelivery(context,requestId,env=process.env){
  const request=readBridgeRequest(context,requestId,env);const path=deliveryFile(context,requestId,env);if(!existsSync(path))fail('BRIDGE_DELIVERY_NOT_FOUND');
  let value;try{value=JSON.parse(readFileSync(path,'utf8'));}catch{fail('BRIDGE_DELIVERY_NOT_FOUND');}return validateDelivery(value,request);
}
export function createDelivery(context,requestId,value,env=process.env){
  const request=readBridgeRequest(context,requestId,env);validateDelivery(value,request);const path=deliveryFile(context,requestId,env);
  if(existsSync(path)){const existing=readDelivery(context,requestId,env);if(JSON.stringify({...existing,createdAt:null})!==JSON.stringify({...value,createdAt:null}))fail('BRIDGE_REQUEST_CONFLICT');return existing;}
  createOnceJson(path,value,'BRIDGE_REQUEST_CONFLICT');return readDelivery(context,requestId,env);
}
function validateReceipt(value,request){
  if(!value||value.schema!==BRIDGE_RECEIPT_SCHEMA||value.requestId!==request.requestId||!['DELIVERED','UNCERTAIN'].includes(value.outcome))fail('BRIDGE_RECEIPT_MISMATCH');
  if(typeof value.deliveryId!=='string'||typeof value.claimId!=='string'||typeof value.createdAt!=='string')fail('BRIDGE_RECEIPT_MISMATCH');return value;
}
export function readReceipt(context,requestId,env=process.env){
  const request=readBridgeRequest(context,requestId,env);const path=receiptFile(context,requestId,env);if(!existsSync(path))return null;
  let value;try{value=JSON.parse(readFileSync(path,'utf8'));}catch{fail('BRIDGE_RECEIPT_MISMATCH');}return validateReceipt(value,request);
}
export function createReceipt(context,requestId,value,env=process.env){
  const request=readBridgeRequest(context,requestId,env);validateReceipt(value,request);const path=receiptFile(context,requestId,env);
  if(existsSync(path)){const existing=readReceipt(context,requestId,env);if(JSON.stringify(existing)!==JSON.stringify(value))fail('BRIDGE_RECEIPT_MISMATCH');return existing;}
  createOnceJson(path,value,'BRIDGE_RECEIPT_MISMATCH');return readReceipt(context,requestId,env);
}
export function listBridgeRequestIds(context,env=process.env){
  const root=requestsRoot(context,env);if(!existsSync(root))return [];
  return readdirSync(root).filter(name=>existsSync(requestFile(context,name,env)));
}
export function sha256(value){return createHash('sha256').update(value,'utf8').digest('hex');}
