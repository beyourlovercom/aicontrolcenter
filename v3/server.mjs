import {createServer as createHttpServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {loadProjectContext,stateRoot} from './lib/project-context.mjs';
import {loadCanonicalRoadmap} from './lib/roadmap.mjs';
import {createTask,createWorkPackage,readWorkStore,updateTaskStatus,updateWorkPackageStatus} from './lib/work-store.mjs';
import {executorStatus,runEvents,runProjection,startRun,stopRun} from './lib/executor-runtime.mjs';
import {readOrMaterializeResult} from './lib/result-store.mjs';

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
  if(['EXECUTOR_LEASE_ACTIVE','EXECUTOR_LEASE_MISMATCH','RUN_PROJECT_MISMATCH','RUN_ALREADY_TERMINAL','RUN_STOP_TARGET_MISMATCH'].includes(code))return 409;
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
async function readJson(req){
  let body='';
  for await(const chunk of req){
    body+=chunk;
    if(body.length>65536){const error=new Error('REQUEST_JSON_INVALID');error.code='REQUEST_JSON_INVALID';throw error;}
  }
  try{return JSON.parse(body||'{}');}
  catch{const error=new Error('REQUEST_JSON_INVALID');error.code='REQUEST_JSON_INVALID';throw error;}
}

export function createAiccV3Server(options={}){
  const env=options.env||process.env;
  const storeOptions=options.workStoreOptions||{};
  const executorOptions=options.executorOptions||{};
  return createHttpServer(async(req,res)=>{
    const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
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

    if(req.method==='GET'&&url.pathname==='/api/executor'){
      try{const context=loadProjectContext(env);return json(res,200,{available:true,executor:executorStatus(context,env,executorOptions)});}
      catch(error){return executorError(res,error);}
    }
    if(req.method==='POST'&&url.pathname==='/api/runs'){
      try{const input=await readJson(req);const context=loadProjectContext(env);return json(res,201,{ok:true,run:startRun(context,input,env,executorOptions)});}
      catch(error){return executorError(res,error);}
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
