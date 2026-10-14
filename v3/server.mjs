import {createServer as createHttpServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {loadProjectContext,loadProjectContextFromBinding,stateRoot} from './lib/project-context.mjs';
import {loadCanonicalRoadmap} from './lib/roadmap.mjs';
import {createTask,createWorkPackage,readRoomWorkStore,readWorkStore,updateTaskStatus,updateWorkPackageStatus} from './lib/work-store.mjs';
import {executorStatus,runEvents,runProjection,startRun,stopRun} from './lib/executor-runtime.mjs';
import {readOrMaterializeResult} from './lib/result-store.mjs';
import {createDraftPr,readPrDeliveryFacts} from './lib/github-delivery.mjs';
import {ensureBridgeCredential,listBridgeRequestIds,readBridgeRequestBinding,verifyBridgeCredential} from './lib/bridge-store.mjs';
import {bridgeProjectionAsync,claimBridgeDeliveryAsync,reconcileBridgeStartup,recordBridgeReceipt,submitBridgeRequestAsync} from './lib/bridge-runtime.mjs';
import {createChatgptProjectionStore} from './lib/chatgpt-projection.mjs';
import {loadNextStepUiPreviewPolicy} from './lib/ui-preview-policy-runtime.mjs';
import {assertNextStepLocal,cancelPendingNextStepForRoom,claimNextStep,createNextStepRequest,readNextStepRequest,reconcileNextStepStartup,recordNextStepReceipt} from './lib/next-step-runtime.mjs';
import {createHumanChatRequest,claimHumanChat,readHumanChatRequest,reconcileHumanChatStartup,recordHumanChatReceipt} from './lib/human-chat-runtime.mjs';
import {RemoteRunnerClient,remoteRunnerBaseUrl,remoteRepositoryRoot} from './lib/remote-runner-client.mjs';
import {externalProjectCatalog} from './lib/external-project-registry.mjs';

const root=dirname(fileURLToPath(import.meta.url));
const publicRoot=join(root,'public');
const assets=new Map([
  ['/',['index.html','text/html; charset=utf-8']],
  ['/app.js',['app.js','text/javascript; charset=utf-8']],
  ['/styles.css',['styles.css','text/css; charset=utf-8']]
]);

function json(res,status,body){
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  res.end(JSON.stringify(body));
}
function configuredExtensionOrigin(env){
  const value=env.AICC_BRIDGE_ALLOWED_ORIGIN;
  return typeof value==='string'&&/^chrome-extension:\/\/[a-p]{32}$/.test(value)?value:null;
}
function extensionOrigin(req,env){
  const origin=req.headers.origin;
  const allowed=configuredExtensionOrigin(env);
  return allowed&&origin===allowed?origin:null;
}
function handleExtensionCors(req,res,url,env){
  const corsPath=url.pathname.startsWith('/api/bridge/')||url.pathname==='/api/work';
  const rawOrigin=req.headers.origin;
  if(!corsPath||typeof rawOrigin!=='string')return false;
  const origin=extensionOrigin(req,env);
  if(!origin){json(res,403,{ok:false,errorCode:'BRIDGE_ORIGIN_DENIED'});return true;}
  res.setHeader('access-control-allow-origin',origin);
  res.setHeader('vary','Origin');
  res.setHeader('access-control-allow-methods','GET, POST, OPTIONS');
  res.setHeader('access-control-allow-headers','content-type, x-aicc-bridge-token');
  res.setHeader('access-control-max-age','600');
  if(req.headers['access-control-request-private-network']==='true')res.setHeader('access-control-allow-private-network','true');
  if(req.method==='OPTIONS'){res.writeHead(204,{'cache-control':'no-store'});res.end();return true;}
  return false;
}
function handleLocalUiCors(req,res,url){
  if(!url.pathname.startsWith('/api/chatgpt/'))return false;
  const rawOrigin=req.headers.origin;
  if(typeof rawOrigin!=='string')return false;
  if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(rawOrigin)){json(res,403,{ok:false,errorCode:'CHATGPT_PROJECTION_ORIGIN_DENIED'});return true;}
  res.setHeader('access-control-allow-origin',rawOrigin);
  res.setHeader('vary','Origin');
  res.setHeader('access-control-allow-methods','GET, OPTIONS');
  res.setHeader('access-control-allow-headers','content-type');
  if(req.method==='OPTIONS'){res.writeHead(204,{'cache-control':'no-store'});res.end();return true;}
  return false;
}
function projectError(error){return {available:false,errorCode:error?.code||'PROJECT_CONTEXT_UNAVAILABLE'};}
function roadmapError(error){return {available:false,status:'NOT_AVAILABLE',errorCode:error?.code||'ROADMAP_UNAVAILABLE'};}
function workErrorStatus(code){
  if(['WORK_PACKAGE_NOT_FOUND','TASK_NOT_FOUND','TASK_WORK_PACKAGE_NOT_FOUND'].includes(code))return 404;
  if(['WORK_STATUS_UNCHANGED','WORK_STATUS_TERMINAL','WORK_STORE_PROJECT_MISMATCH'].includes(code))return 409;
  if(['WORK_INPUT_INVALID','WORK_STATUS_INVALID','REQUEST_JSON_INVALID'].includes(code))return 400;
  return 503;
}
function workError(res,error){
  const errorCode=error?.code||'WORK_UNAVAILABLE';
  return json(res,workErrorStatus(errorCode),{ok:false,errorCode});
}
function executorErrorStatus(code){
  if(['RUN_NOT_FOUND','RUN_TASK_NOT_FOUND'].includes(code))return 404;
  if(['RUN_INSTRUCTION_INVALID'].includes(code))return 400;
  if(['EXECUTOR_LEASE_ACTIVE','EXECUTOR_LEASE_MISMATCH','EXECUTOR_REMOTE_CLAUDE_LEASE_CONFLICT','RUN_PROJECT_MISMATCH','RUN_ALREADY_TERMINAL','RUN_STOP_TARGET_MISMATCH'].includes(code))return 409;
  return 503;
}
function executorError(res,error){
  const errorCode=error?.code||'EXECUTOR_NOT_READY';
  const body={ok:false,errorCode};if(error?.runId)body.runId=error.runId;
  return json(res,executorErrorStatus(errorCode),body);
}
function resultErrorStatus(code){
  if(['RESULT_NOT_FOUND'].includes(code))return 404;
  if(['RESULT_NOT_READY','RESULT_PROJECT_MISMATCH','RESULT_RUN_MISMATCH','RESULT_CONFLICT'].includes(code))return 409;
  if(['RESULT_SOURCE_NOT_FOUND','RESULT_SOURCE_EVENT_INVALID','RESULT_INVALID'].includes(code))return 422;
  return 503;
}
function resultError(res,error){
  const errorCode=error?.code||'RESULT_INVALID';
  return json(res,resultErrorStatus(errorCode),{available:false,errorCode});
}
function prErrorStatus(code){
  if(['PR_INPUT_INVALID','REQUEST_JSON_INVALID'].includes(code))return 400;
  if(['PR_ALREADY_EXISTS','PR_LOCAL_WORKTREE_DIRTY','PR_HEAD_IS_DEFAULT_BRANCH','PR_REMOTE_HEAD_NOT_FOUND','PR_REMOTE_HEAD_MISMATCH','PR_BASE_NOT_FOUND','PR_BASE_EQUALS_HEAD'].includes(code))return 409;
  return 503;
}
function prError(res,error){
  const errorCode=error?.code||'GITHUB_NOT_READY';const body={ok:false,errorCode};
  if(error?.existingPr)body.existingPr=error.existingPr;return json(res,prErrorStatus(errorCode),body);
}

function bridgeErrorStatus(code){
  if(code==='BRIDGE_AUTH_REQUIRED')return 401;
  if(['BRIDGE_TASK_NOT_FOUND','BRIDGE_DELIVERY_NOT_FOUND'].includes(code))return 404;
  if(['BRIDGE_REQUEST_INVALID','BRIDGE_CONVERSATION_ID_UNAVAILABLE','BRIDGE_ORIGIN_TURN_ID_REQUIRED','REQUEST_JSON_INVALID'].includes(code))return 400;
  if(['BRIDGE_REQUEST_CONFLICT','BRIDGE_PROJECT_MISMATCH','BRIDGE_RUN_BINDING_FAILED','BRIDGE_RESULT_NOT_READY','BRIDGE_DELIVERY_ALREADY_CLAIMED','BRIDGE_DELIVERY_ALREADY_DELIVERED','BRIDGE_DELIVERY_UNCERTAIN','BRIDGE_CONVERSATION_MISMATCH','BRIDGE_RECEIPT_MISMATCH','BRIDGE_RETRY_EXHAUSTED','BRIDGE_REMOTE_EXECUTION_FAILED','BRIDGE_REMOTE_EXECUTION_UNCERTAIN','BRIDGE_REMOTE_RESULT_INVALID'].includes(code))return 409;
  return 503;
}
function bridgeError(res,error){const errorCode=error?.code||'BRIDGE_REQUEST_INVALID';return json(res,bridgeErrorStatus(errorCode),{ok:false,errorCode});}
function nextStepErrorStatus(code){
  if(code==='NEXT_STEP_NOT_FOUND')return 404;
  if(['NEXT_STEP_INPUT_INVALID','NEXT_STEP_CONVERSATION_REQUIRED','REQUEST_JSON_INVALID'].includes(code))return 400;
  if(code==='NEXT_STEP_LOCAL_ONLY')return 403;
  if(['NEXT_STEP_RUNTIME_DRIFT','NEXT_STEP_WORKTREE_DIRTY','NEXT_STEP_EXECUTOR_NOT_READY','NEXT_STEP_EXECUTOR_BUSY','NEXT_STEP_CONVERSATION_STALE','NEXT_STEP_ACTIVE','NEXT_STEP_CLAIM_MISMATCH','NEXT_STEP_RECEIPT_INVALID'].includes(code))return 409;
  return 503;
}
function nextStepError(res,error){const errorCode=error?.code||'NEXT_STEP_INVALID';return json(res,nextStepErrorStatus(errorCode),{ok:false,errorCode});}
function humanChatError(res,error){const errorCode=error?.code||'HUMAN_CHAT_INVALID';const status=errorCode==='HUMAN_CHAT_NOT_FOUND'?404:['HUMAN_CHAT_INPUT_INVALID','REQUEST_JSON_INVALID'].includes(errorCode)?400:['HUMAN_CHAT_CLAIM_MISMATCH','HUMAN_CHAT_RECEIPT_INVALID'].includes(errorCode)?409:503;return json(res,status,{ok:false,errorCode});}
function requireBridgeAuth(req,env,options={}){
  const remote=req.socket?.remoteAddress||'';
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote)){const error=new Error('BRIDGE_AUTH_REQUIRED');error.code='BRIDGE_AUTH_REQUIRED';throw error;}
  const raw=req.headers['x-aicc-bridge-token'];const token=Array.isArray(raw)?raw[0]:raw;
  verifyBridgeCredential(token,env,options.credentialOptions||{});
}
function bridgeRuntimeContext(input,env){
  const runtime=input?.runtimeBinding;if(!runtime)return loadProjectContext(env);
  const context=loadProjectContextFromBinding({projectId:runtime.projectId,projectName:runtime.projectName||runtime.projectId,repositoryIdentity:runtime.repositoryIdentity,repositoryPath:runtime.repositoryPath});
  if(context.repository.branch!==runtime.branch||context.repository.head!==runtime.head){const error=new Error('BRIDGE_PROJECT_MISMATCH');error.code='BRIDGE_PROJECT_MISMATCH';throw error;}
  if(context.repository.dirty){const error=new Error('BRIDGE_RUN_BINDING_FAILED');error.code='BRIDGE_RUN_BINDING_FAILED';throw error;}
  return context;
}
function bridgeRequestContext(requestId,env){
  const binding=readBridgeRequestBinding(requestId,env);
  return loadProjectContextFromBinding({projectId:binding.projectId,projectName:binding.projectId,repositoryIdentity:binding.repositoryIdentity,repositoryPath:binding.repositoryPath});
}

async function readJson(req,maxBytes=65536){
  let body='';
  for await(const chunk of req){
    body+=chunk;
    if(body.length>maxBytes){const error=new Error('REQUEST_JSON_INVALID');error.code='REQUEST_JSON_INVALID';throw error;}
  }
  try{return JSON.parse(body||'{}');}
  catch{const error=new Error('REQUEST_JSON_INVALID');error.code='REQUEST_JSON_INVALID';throw error;}
}

export function createAiccV3Server(options={}){
  const env=options.env||process.env;
  const storeOptions=options.workStoreOptions||{};
  const executorOptions=options.executorOptions||{};
  const prDeliveryOptions=options.prDeliveryOptions||{};
  const prFactsCache=new Map();
  const prFactsTtlMs=Number.isFinite(options.prFactsTtlMs)?Math.max(0,Number(options.prFactsTtlMs)):30000;
  const readCachedPrDelivery=(context)=>{
    const repository=context.repository;
    const key=[context.project.id,repository.identity,repository.path,repository.branch,repository.head,String(repository.dirty)].join('\0');
    const now=Date.now();const hit=prFactsCache.get(key);
    if(hit&&now-hit.at<=prFactsTtlMs)return hit.value;
    const value=readPrDeliveryFacts(context,env,prDeliveryOptions);
    prFactsCache.set(key,{at:now,value});
    return value;
  };
  const runnerBaseUrl=options.remoteRunnerBaseUrl!==undefined?options.remoteRunnerBaseUrl:remoteRunnerBaseUrl(env);
  const remoteRunner=options.remoteRunner||(runnerBaseUrl?new RemoteRunnerClient(runnerBaseUrl):null);
  const bridgeOptions={
    ...(options.bridgeOptions||{}),
    executorOptions:options.bridgeOptions?.executorOptions||executorOptions,
    remoteRunner:options.bridgeOptions?.remoteRunner||remoteRunner,
    remoteRepositoryRoot:options.bridgeOptions?.remoteRepositoryRoot||options.remoteRepositoryRoot||remoteRepositoryRoot(env)
  };
  const chatgptProjection=options.chatgptProjectionStore||createChatgptProjectionStore();
  try{
    const seen=new Set();
    for(const requestId of listBridgeRequestIds(null,env)){
      try{
        const binding=readBridgeRequestBinding(requestId,env);const key=`${binding.projectId}\0${binding.repositoryIdentity}\0${binding.repositoryPath}`;
        if(seen.has(key))continue;seen.add(key);
        const context=loadProjectContextFromBinding({projectId:binding.projectId,projectName:binding.projectId,repositoryIdentity:binding.repositoryIdentity,repositoryPath:binding.repositoryPath});
        reconcileBridgeStartup(context,env,bridgeOptions);
      }catch{}
    }
    if(!seen.size){try{const context=loadProjectContext(env);reconcileBridgeStartup(context,env,bridgeOptions);}catch{}}
  }catch{}
  try{reconcileNextStepStartup(null,env,options.nextStepOptions||{});}catch{}
  try{reconcileHumanChatStartup(env,options.humanChatOptions||{});}catch{}
  return createHttpServer(async(req,res)=>{
    const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
    if(handleExtensionCors(req,res,url,env))return;
    if(handleLocalUiCors(req,res,url))return;
    if(req.method==='GET'&&url.pathname==='/api/health'){
      try{
        const context=loadProjectContext(env);
        return json(res,200,{schema:'aicc.v3.health.v1',ok:true,service:'AICC_V3',project:{available:true,id:context.project.id}});
      }catch(error){return json(res,200,{schema:'aicc.v3.health.v1',ok:true,service:'AICC_V3',project:projectError(error)});}
    }

    if(req.method==='GET'&&url.pathname==='/api/project'){
      try{return json(res,200,{available:true,context:loadProjectContext(env)});}
      catch(error){return json(res,503,projectError(error));}
    }

    if(req.method==='GET'&&url.pathname==='/api/external-projects'){
      try{assertNextStepLocal(req.socket?.remoteAddress||'');return json(res,200,{available:true,catalog:externalProjectCatalog(env)});}
      catch(error){return json(res,503,{available:false,errorCode:error?.code||'EXTERNAL_PROJECTS_UNAVAILABLE'});}
    }

    if(req.method==='POST'&&url.pathname==='/api/room-facts'){
      try{
        assertNextStepLocal(req.socket?.remoteAddress||'');const input=await readJson(req,16384);
        const context=loadProjectContextFromBinding(input);
        const source=(read,fallback)=>{try{return {available:true,value:read(),errorCode:null};}catch(error){return {available:false,value:null,errorCode:error?.code||fallback};}};
        const facts={
          capturedAt:new Date().toISOString(),
          project:{available:true,value:context,errorCode:null},
          executor:source(()=>executorStatus(context,env,executorOptions),'EXECUTOR_FACTS_UNAVAILABLE'),
          prDelivery:source(()=>readCachedPrDelivery(context),'PR_FACTS_UNAVAILABLE'),
          work:source(()=>readRoomWorkStore(context,input?.roomId,input?.workstreamId,env),'WORK_FACTS_UNAVAILABLE')
        };
        return json(res,200,{available:true,facts});
      }catch(error){return json(res,409,{available:false,errorCode:error?.code||'ROOM_RUNTIME_UNAVAILABLE'});}
    }

    if(req.method==='GET'&&url.pathname==='/api/roadmap'){
      try{const context=loadProjectContext(env);return json(res,200,{available:true,roadmap:loadCanonicalRoadmap(context)});}
      catch(error){return json(res,503,roadmapError(error));}
    }

    if(req.method==='GET'&&url.pathname==='/api/work'){
      try{const context=loadProjectContext(env);return json(res,200,{available:true,store:readWorkStore(context,env)});}
      catch(error){return workError(res,error);}
    }
    if(req.method==='POST'&&url.pathname==='/api/work-packages'){
      try{
        const input=await readJson(req);const context=loadProjectContext(env);
        return json(res,201,{ok:true,...createWorkPackage(context,input,env,storeOptions)});
      }catch(error){return workError(res,error);}
    }

    const wpStatus=url.pathname.match(/^\/api\/work-packages\/([^/]+)\/status$/);
    if(req.method==='PATCH'&&wpStatus){
      try{
        const input=await readJson(req);const context=loadProjectContext(env);
        return json(res,200,{ok:true,...updateWorkPackageStatus(context,decodeURIComponent(wpStatus[1]),input?.status,env,storeOptions)});
      }catch(error){return workError(res,error);}
    }

    if(req.method==='POST'&&url.pathname==='/api/tasks'){
      try{
        const input=await readJson(req);const context=loadProjectContext(env);
        return json(res,201,{ok:true,...createTask(context,input,env,storeOptions)});
      }catch(error){return workError(res,error);}
    }
    const taskStatus=url.pathname.match(/^\/api\/tasks\/([^/]+)\/status$/);
    if(req.method==='PATCH'&&taskStatus){
      try{
        const input=await readJson(req);const context=loadProjectContext(env);
        return json(res,200,{ok:true,...updateTaskStatus(context,decodeURIComponent(taskStatus[1]),input?.status,env,storeOptions)});
      }catch(error){return workError(res,error);}
    }

    if(req.method==='GET'&&url.pathname==='/api/pr-delivery'){
      try{const context=loadProjectContext(env);return json(res,200,{available:true,delivery:readCachedPrDelivery(context)});}
      catch(error){return prError(res,error);}
    }
    if(req.method==='POST'&&url.pathname==='/api/prs/draft'){
      try{const input=await readJson(req);const context=loadProjectContext(env);return json(res,201,{ok:true,pullRequest:createDraftPr(context,input,env,prDeliveryOptions)});}
      catch(error){return prError(res,error);}
    }

    if(req.method==='POST'&&url.pathname==='/api/next-step/requests'){
      try{
        assertNextStepLocal(req.socket?.remoteAddress||'');const input=await readJson(req,16384);
        const context=loadProjectContextFromBinding({projectId:input?.projectId,projectName:input?.roomName||input?.projectId,repositoryIdentity:input?.repositoryIdentity,repositoryPath:input?.worktree});
        const executor=executorStatus(context,env,executorOptions);const snapshot=chatgptProjection.get(input?.conversationId);
        let work=null,prDelivery=null;try{work=readRoomWorkStore(context,input?.roomId,input?.workstreamId,env);}catch{}try{prDelivery=readCachedPrDelivery(context);}catch{}
        // Pre-submit governance only: pin canonical GitHub policy into the NEW immutable GPT prompt.
        // Existing frozen requests and Bridge / Result transport are never rewritten.
        const uiPreviewPolicy=await (options.nextStepUiPreviewPolicyLoader||loadNextStepUiPreviewPolicy)();
        const created=createNextStepRequest(context,input,{executorReady:Boolean(executor?.readiness?.ready),activeRun:executor?.activeLease?.runId||null,snapshot,work,prDelivery},env,{...(options.nextStepOptions||{}),uiPreviewPolicy});
        return json(res,201,{ok:true,...created});
      }catch(error){return nextStepError(res,error);}
    }
    const nextStepRoomCancel=url.pathname.match(/^\/api\/next-step\/rooms\/([^/]+)\/cancel-pending$/);
    if(req.method==='POST'&&nextStepRoomCancel){
      try{assertNextStepLocal(req.socket?.remoteAddress||'');return json(res,200,{ok:true,...cancelPendingNextStepForRoom(null,decodeURIComponent(nextStepRoomCancel[1]),env,options.nextStepOptions||{})});}
      catch(error){return nextStepError(res,error);}
    }

    const nextStepRequest=url.pathname.match(/^\/api\/next-step\/requests\/([^/]+)$/);
    if(req.method==='GET'&&nextStepRequest){
      try{assertNextStepLocal(req.socket?.remoteAddress||'');return json(res,200,{available:true,...readNextStepRequest(null,decodeURIComponent(nextStepRequest[1]),env)});}
      catch(error){return nextStepError(res,error);}
    }

    if(req.method==='POST'&&url.pathname==='/api/chat/requests'){
      try{assertNextStepLocal(req.socket?.remoteAddress||'');const input=await readJson(req,16384);return json(res,201,{ok:true,...createHumanChatRequest(input,env,options.humanChatOptions||{})});}
      catch(error){return humanChatError(res,error);}
    }
    const humanChatRequest=url.pathname.match(/^\/api\/chat\/requests\/([^/]+)$/);
    if(req.method==='GET'&&humanChatRequest){
      try{assertNextStepLocal(req.socket?.remoteAddress||'');return json(res,200,{available:true,...readHumanChatRequest(decodeURIComponent(humanChatRequest[1]),env)});}
      catch(error){return humanChatError(res,error);}
    }
    if(req.method==='GET'&&url.pathname==='/api/chatgpt/snapshots'){
      return json(res,200,{available:true,provider:'chatgpt-web',snapshots:chatgptProjection.list()});
    }
    const chatgptSnapshot=url.pathname.match(/^\/api\/chatgpt\/snapshots\/([^/]+)$/);
    if(req.method==='GET'&&chatgptSnapshot){
      const conversationId=decodeURIComponent(chatgptSnapshot[1]);const snapshot=chatgptProjection.get(conversationId);
      return snapshot?json(res,200,{available:true,snapshot}):json(res,404,{available:false,errorCode:'CHATGPT_SNAPSHOT_NOT_FOUND'});
    }

    if(req.method==='POST'&&url.pathname==='/api/bridge/bootstrap'){
      const remote=req.socket?.remoteAddress||'';const origin=extensionOrigin(req,env);
      if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote)||!origin)return json(res,403,{ok:false,errorCode:'BRIDGE_ORIGIN_DENIED'});
      return json(res,200,{ok:true,token:ensureBridgeCredential(env,bridgeOptions.credentialOptions||{})});
    }
    if(url.pathname.startsWith('/api/bridge/')){
      try{requireBridgeAuth(req,env,bridgeOptions);}catch(error){return bridgeError(res,error);}
    }
    if(req.method==='POST'&&url.pathname==='/api/bridge/snapshots'){
      try{const input=await readJson(req,524288);return json(res,200,{ok:true,snapshot:chatgptProjection.upsert(input)});}
      catch(error){return json(res,400,{ok:false,errorCode:error?.code||'CHATGPT_SNAPSHOT_INVALID'});}
    }
    if(req.method==='POST'&&url.pathname==='/api/bridge/chat/claim'){
      try{const input=await readJson(req);return json(res,200,{ok:true,claimed:claimHumanChat(input,env,options.humanChatOptions||{})});}
      catch(error){return humanChatError(res,error);}
    }
    const humanChatReceipt=url.pathname.match(/^\/api\/bridge\/chat\/([^/]+)\/receipt$/);
    if(req.method==='POST'&&humanChatReceipt){
      try{const input=await readJson(req,16384);return json(res,200,{ok:true,...recordHumanChatReceipt(decodeURIComponent(humanChatReceipt[1]),input,env,options.humanChatOptions||{})});}
      catch(error){return humanChatError(res,error);}
    }
    if(req.method==='POST'&&url.pathname==='/api/bridge/next-step/claim'){
      try{const input=await readJson(req);const claimed=claimNextStep(null,input,env,options.nextStepOptions||{});return json(res,200,{ok:true,claimed});}
      catch(error){return nextStepError(res,error);}
    }
    const nextStepReceipt=url.pathname.match(/^\/api\/bridge\/next-step\/([^/]+)\/receipt$/);
    if(req.method==='POST'&&nextStepReceipt){
      try{const input=await readJson(req,16384);return json(res,200,{ok:true,...recordNextStepReceipt(null,decodeURIComponent(nextStepReceipt[1]),input,env,options.nextStepOptions||{})});}
      catch(error){return nextStepError(res,error);}
    }
    if(req.method==='POST'&&url.pathname==='/api/bridge/requests'){
      try{const input=await readJson(req);const context=bridgeRuntimeContext(input,env);return json(res,201,{ok:true,...await submitBridgeRequestAsync(context,input,env,bridgeOptions)});}
      catch(error){return bridgeError(res,error);}
    }
    const bridgeClaim=url.pathname.match(/^\/api\/bridge\/requests\/([^/]+)\/claim$/);
    if(req.method==='POST'&&bridgeClaim){
      try{const input=await readJson(req);const requestId=decodeURIComponent(bridgeClaim[1]);const context=bridgeRequestContext(requestId,env);return json(res,200,{ok:true,...await claimBridgeDeliveryAsync(context,requestId,input,env,bridgeOptions)});}
      catch(error){return bridgeError(res,error);}
    }
    const bridgeReceipt=url.pathname.match(/^\/api\/bridge\/requests\/([^/]+)\/receipt$/);
    if(req.method==='POST'&&bridgeReceipt){
      try{const input=await readJson(req);const requestId=decodeURIComponent(bridgeReceipt[1]);const context=bridgeRequestContext(requestId,env);return json(res,200,{ok:true,...recordBridgeReceipt(context,requestId,input,env,bridgeOptions)});}
      catch(error){return bridgeError(res,error);}
    }
    const bridgeRequest=url.pathname.match(/^\/api\/bridge\/requests\/([^/]+)$/);
    if(req.method==='GET'&&bridgeRequest){
      try{const requestId=decodeURIComponent(bridgeRequest[1]);const context=bridgeRequestContext(requestId,env);return json(res,200,{available:true,bridge:await bridgeProjectionAsync(context,requestId,env,bridgeOptions)});}
      catch(error){return bridgeError(res,error);}
    }

    if(req.method==='GET'&&url.pathname==='/api/executor'){
      try{
        const context=loadProjectContext(env);
        const executor=executorStatus(context,env,executorOptions);
        let remoteClaudeReadiness={available:false,errorCode:'REMOTE_RUNNER_NOT_CONFIGURED'};
        if(remoteRunner){
          try{const s=await remoteRunner.status();remoteClaudeReadiness={available:true,ready:true,...s};}
          catch(error){remoteClaudeReadiness={available:false,errorCode:error?.code||'REMOTE_RUNNER_UNAVAILABLE'};}
        }
        return json(res,200,{available:true,executor,remoteClaudeReadiness});
      }
      catch(error){return executorError(res,error);}
    }
    if(req.method==='POST'&&url.pathname==='/api/runs'){
      try{
        const input=await readJson(req);const context=loadProjectContext(env);
        if(remoteRunner){
          const remoteStatus=await remoteRunner.status();
          const conflict=(remoteStatus?.activeLeases||[]).some(lease=>lease?.repositoryIdentity===context.repository.identity&&lease?.branch===context.repository.branch);
          if(conflict){const error=new Error('EXECUTOR_REMOTE_CLAUDE_LEASE_CONFLICT');error.code='EXECUTOR_REMOTE_CLAUDE_LEASE_CONFLICT';throw error;}
        }
        return json(res,201,{ok:true,run:startRun(context,input,env,executorOptions)});
      }catch(error){return executorError(res,error);}
    }
    const runEventsMatch=url.pathname.match(/^\/api\/runs\/([^/]+)\/events$/);
    if(req.method==='GET'&&runEventsMatch){
      try{
        const afterText=url.searchParams.get('after')||'0';const after=Number(afterText);
        if(!Number.isInteger(after)||after<0){const error=new Error('RUN_EVENT_STREAM_INVALID');error.code='RUN_EVENT_STREAM_INVALID';throw error;}
        const context=loadProjectContext(env);const runId=decodeURIComponent(runEventsMatch[1]);
        return json(res,200,{available:true,runId,events:runEvents(context,runId,after,env)});
      }catch(error){return executorError(res,error);}
    }
    const runResultMatch=url.pathname.match(/^\/api\/runs\/([^/]+)\/result$/);
    if(req.method==='GET'&&runResultMatch){
      try{
        const context=loadProjectContext(env);const runId=decodeURIComponent(runResultMatch[1]);
        return json(res,200,{available:true,result:readOrMaterializeResult(context,runId,env)});
      }catch(error){return resultError(res,error);}
    }
    const runStopMatch=url.pathname.match(/^\/api\/runs\/([^/]+)\/stop$/);
    if(req.method==='POST'&&runStopMatch){
      try{const context=loadProjectContext(env);const runId=decodeURIComponent(runStopMatch[1]);return json(res,200,{ok:true,...stopRun(context,runId,env,executorOptions)});}
      catch(error){return executorError(res,error);}
    }
    const runMatch=url.pathname.match(/^\/api\/runs\/([^/]+)$/);
    if(req.method==='GET'&&runMatch){
      try{const context=loadProjectContext(env);const runId=decodeURIComponent(runMatch[1]);return json(res,200,{available:true,run:runProjection(context,runId,env,executorOptions)});}
      catch(error){return executorError(res,error);}
    }

    if(req.method==='GET'){
      const asset=assets.get(url.pathname);
      if(asset){
        const [file,type]=asset;
        try{
          const body=readFileSync(join(publicRoot,file));
          res.writeHead(200,{'content-type':type,'cache-control':'no-store'});
          return res.end(body);
        }catch{return json(res,500,{error:'STATIC_ASSET_READ_FAILED'});}
      }
    }

    return json(res,404,{error:'NOT_FOUND'});
  });
}
if(import.meta.url===`file://${process.argv[1]}`){
  const host=process.env.AICC_HOST||'127.0.0.1';
  const port=Number(process.env.AICC_PORT||1420);
  const server=createAiccV3Server();
  server.listen(port,host,()=>{
    console.log(JSON.stringify({service:'AICC_V3',host,port,stateRoot:stateRoot()}));
  });
}
