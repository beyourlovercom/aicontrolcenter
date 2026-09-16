import {createServer} from 'node:http';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {createRemoteRunnerService} from '../v3/lib/remote-runner-service.mjs';

const env=process.env;
const host=env.AICC_RUNNER_HOST;
const port=Number(env.AICC_RUNNER_PORT||'8787');
const allowedRoot=env.AICC_RUNNER_ALLOWED_ROOT;
const allowedRemote=env.AICC_RUNNER_ALLOWED_REMOTE;
const runnerStateRoot=env.AICC_RUNNER_STATE_ROOT||join(homedir(),'.aicc-remote','aicc-runner-state');

if(!host){console.error('FATAL: AICC_RUNNER_HOST is required. Remote runner must not bind to 0.0.0.0.');process.exit(1);}
if(!allowedRoot){console.error('FATAL: AICC_RUNNER_ALLOWED_ROOT is required.');process.exit(1);}

const service=createRemoteRunnerService(allowedRoot,{stateRoot:runnerStateRoot});

function json(res,status,body){
  res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});
  res.end(JSON.stringify(body));
}

function checkPeerAllowlist(remoteAddress){
  if(!allowedRemote)return true;
  const allowed=allowedRemote.split(',').map(s=>s.trim()).filter(Boolean);
  const addr=(remoteAddress||'').replace(/^::ffff:/,'');
  return allowed.includes(addr)||allowed.includes(remoteAddress||'');
}

createServer(async(req,res)=>{
  const remote=req.socket?.remoteAddress||'';
  if(!checkPeerAllowlist(remote))return json(res,403,{errorCode:'REMOTE_RUNNER_PEER_DENIED'});

  const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
  const parts=url.pathname.split('/').filter(Boolean);
  let body='';req.on('data',c=>body+=c);
  await new Promise(r=>req.on('end',r));

  try{
    if(req.method==='GET'&&url.pathname==='/v1/health')return json(res,200,service.health());
    if(req.method==='GET'&&url.pathname==='/v1/status')return json(res,200,service.status());
    if(req.method==='POST'&&url.pathname==='/v1/executions'){
      let input;try{input=JSON.parse(body);}catch{return json(res,400,{errorCode:'REMOTE_RUNNER_JSON_INVALID'});}
      return json(res,202,service.submit(input));
    }
    if(req.method==='GET'&&parts[0]==='v1'&&parts[1]==='executions'&&parts[2]){
      const rec=service.get(decodeURIComponent(parts[2]));
      return rec?json(res,200,rec):json(res,404,{errorCode:'REMOTE_RUNNER_EXECUTION_NOT_FOUND'});
    }
    return json(res,404,{errorCode:'REMOTE_RUNNER_NOT_FOUND'});
  }catch(error){
    json(res,409,{errorCode:error?.code||'REMOTE_RUNNER_ERROR'});
  }
}).listen(port,host,()=>{
  console.log(`AICC Remote Runner listening on ${host}:${port}${allowedRemote?` allowedRemote=${allowedRemote}`:''}`);
});
