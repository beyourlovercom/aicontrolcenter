import {createHash,randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,readdirSync,renameSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {stateRoot} from './project-context.mjs';

export const HUMAN_CHAT_STATES=Object.freeze(['PENDING','CLAIMED','DELIVERED','ABORTED_BEFORE_SEND','UNCERTAIN']);
function fail(code){const error=new Error(code);error.code=code;throw error;}
function now(options={}){return (options.now||(()=>new Date().toISOString()))();}
function text(value,code,max=12000){if(typeof value!=='string'||!value.trim()||value.length>max)fail(code);return value.trim();}
function root(env){return join(stateRoot(env),'human-chat');}
function requestDir(id,env){return join(root(env),'requests',id);}
function requestFile(id,env){return join(requestDir(id,env),'request.v1.json');}
function stateFile(id,env){return join(requestDir(id,env),'state.v1.json');}
function atomic(path,value){mkdirSync(dirname(path),{recursive:true});const temp=path+'.'+process.pid+'.tmp';writeFileSync(temp,JSON.stringify(value,null,2)+'\n');renameSync(temp,path);}
function ids(env){const dir=join(root(env),'requests');return existsSync(dir)?readdirSync(dir).sort():[];}
export function createHumanChatRequest(input,env=process.env,options={}){
  const requestId=(options.uuid||randomUUID)();
  const content=text(input?.content,'HUMAN_CHAT_INPUT_INVALID',12000);
  const request={schema:'aicc.v1.human-chat-request',requestId,roomId:text(input?.roomId,'HUMAN_CHAT_INPUT_INVALID',240),conversationId:text(input?.conversationId,'HUMAN_CHAT_INPUT_INVALID',500),conversationUrl:text(input?.conversationUrl,'HUMAN_CHAT_INPUT_INVALID',2000),content,contentSha256:createHash('sha256').update(content).digest('hex'),createdAt:now(options)};
  const state={schema:'aicc.v1.human-chat-state',requestId,state:'PENDING',claim:null,errorCode:null,updatedAt:request.createdAt};
  const dir=requestDir(requestId,env);mkdirSync(dirname(dir),{recursive:true});mkdirSync(dir,{recursive:false});writeFileSync(requestFile(requestId,env),JSON.stringify(request,null,2)+'\n',{flag:'wx'});atomic(stateFile(requestId,env),state);return {request,state};
}
export function readHumanChatRequest(id,env=process.env){
  let request,state;try{request=JSON.parse(readFileSync(requestFile(id,env),'utf8'));state=JSON.parse(readFileSync(stateFile(id,env),'utf8'));}catch{fail('HUMAN_CHAT_NOT_FOUND');}
  if(request?.schema!=='aicc.v1.human-chat-request'||state?.schema!=='aicc.v1.human-chat-state'||request.requestId!==id||state.requestId!==id||!HUMAN_CHAT_STATES.includes(state.state))fail('HUMAN_CHAT_INVALID');
  return {request,state};
}
export function claimHumanChat(input,env=process.env,options={}){
  const bridgeInstanceId=text(input?.bridgeInstanceId,'HUMAN_CHAT_INPUT_INVALID',500);
  for(const id of ids(env)){const value=readHumanChatRequest(id,env);if(value.state.state!=='PENDING')continue;const claim={claimId:(options.uuid||randomUUID)(),bridgeInstanceId,claimedAt:now(options)};const state={...value.state,state:'CLAIMED',claim,updatedAt:now(options)};atomic(stateFile(id,env),state);return {request:value.request,state};}
  return null;
}
export function recordHumanChatReceipt(id,input,env=process.env,options={}){
  const value=readHumanChatRequest(id,env);if(value.state.state!=='CLAIMED'||!value.state.claim||input?.claimId!==value.state.claim.claimId)fail('HUMAN_CHAT_CLAIM_MISMATCH');
  const outcome=input?.outcome;if(!['DELIVERED','ABORTED_BEFORE_SEND','UNCERTAIN'].includes(outcome))fail('HUMAN_CHAT_RECEIPT_INVALID');
  const state={...value.state,state:outcome,claim:null,errorCode:typeof input?.errorCode==='string'?input.errorCode:null,updatedAt:now(options)};atomic(stateFile(id,env),state);return {request:value.request,state};
}
export function reconcileHumanChatStartup(env=process.env,options={}){
  const changed=[];for(const id of ids(env)){try{const value=readHumanChatRequest(id,env);if(value.state.state!=='CLAIMED')continue;const state={...value.state,state:'UNCERTAIN',claim:null,errorCode:'HUMAN_CHAT_RESTART_AFTER_CLAIM',updatedAt:now(options)};atomic(stateFile(id,env),state);changed.push(id);}catch{}}return changed;
}
