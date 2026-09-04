import {createServer as createHttpServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {loadProjectContext,stateRoot} from './lib/project-context.mjs';
import {loadCanonicalRoadmap} from './lib/roadmap.mjs';
import {createTask,createWorkPackage,readWorkStore,updateTaskStatus,updateWorkPackageStatus} from './lib/work-store.mjs';

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
