import {createServer as createHttpServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {loadProjectContext,stateRoot} from './lib/project-context.mjs';

const root=dirname(fileURLToPath(import.meta.url));
const publicRoot=join(root,'public');

const assets=new Map([
  ['/',['index.html','text/html; charset=utf-8']],
  ['/app.js',['app.js','text/javascript; charset=utf-8']],
  ['/styles.css',['styles.css','text/css; charset=utf-8']]
]);

function json(res,status,body){
  const data=JSON.stringify(body);
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  res.end(data);
}

function projectError(error){
  return {available:false,errorCode:error?.code||'PROJECT_CONTEXT_UNAVAILABLE'};
}

export function createAiccV3Server(options={}){
  const env=options.env||process.env;
  return createHttpServer((req,res)=>{
    const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
    if(req.method!=='GET')return json(res,405,{error:'METHOD_NOT_ALLOWED'});

    if(url.pathname==='/api/health'){
      try{
        const context=loadProjectContext(env);
        return json(res,200,{schema:'aicc.v3.health.v1',ok:true,service:'AICC_V3',project:{available:true,id:context.project.id}});
      }catch(error){
        return json(res,200,{schema:'aicc.v3.health.v1',ok:true,service:'AICC_V3',project:projectError(error)});
      }
    }

    if(url.pathname==='/api/project'){
      try{return json(res,200,{available:true,context:loadProjectContext(env)});}
      catch(error){return json(res,503,projectError(error));}
    }

    const asset=assets.get(url.pathname);
    if(asset){
      const [file,type]=asset;
      try{
        const body=readFileSync(join(publicRoot,file));
        res.writeHead(200,{'content-type':type,'cache-control':'no-store'});
        return res.end(body);
      }catch{return json(res,500,{error:'STATIC_ASSET_READ_FAILED'});}
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
