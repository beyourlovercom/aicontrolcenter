/** Localhost-only OAuth compatibility rehearsal, not a production cutover.
 * Reuses verified candidate 8795 Cloudflare credentials for LOCAL E2E ONLY.
 * Runtime never binds a public interface; public Tunnel remains unchanged.
 */
import {execFileSync,spawn} from 'node:child_process';
import {openSync,closeSync} from 'node:fs';
const base='/tmp/byl-mcp-oauth-compat-uat-20261009';
const get=(bin,args)=>execFileSync(bin,args,{encoding:'utf8',maxBuffer:1048576});
async function main(){
 const marker=get('/usr/sbin/lsof',['-nP','-iTCP:8797','-sTCP:LISTEN','-Fp']);
 if(marker.trim())throw Error('PORT_8797_ALREADY_BOUND');
 const sourcePid=Number(get('/usr/sbin/lsof',['-nP','-iTCP:8795','-sTCP:LISTEN','-Fp']).match(/p(\d+)/)?.[1]);
 if(!Number.isSafeInteger(sourcePid))throw Error('SOURCE_CANDIDATE_MISSING');
 const processInfo=get('/bin/ps',['eww','-p',String(sourcePid),'-o','command=']);
 const names=['BYL_MCP_ACCESS_ENABLED','BYL_MCP_ACCESS_ISSUER','BYL_MCP_ACCESS_AUDIENCE','BYL_MCP_ACCESS_READ_EMAILS','BYL_MCP_ACCESS_OPERATE_EMAILS'];
 const env={...process.env};
 for(const key of names){
  const value=processInfo.match(new RegExp('(?:^|\\s)'+key+'=([^\\s]*)'))?.[1];
  if(!value)throw Error('SOURCE_CONFIG_MISSING_'+key);
  env[key]=value;
 }
 if(env.BYL_MCP_ACCESS_ENABLED!=='1'||env.BYL_MCP_ACCESS_READ_EMAILS!==env.BYL_MCP_ACCESS_OPERATE_EMAILS)throw Error('ACCESS_OWNER_GUARD_FAILED');
 Object.assign(env,{
  BYL_MCP_STAGING:'0',BYL_MCP_UAT_CANDIDATE:'0',
  BYL_MCP_OAUTH_COMPAT_CANDIDATE:'1',
  BYL_MCP_OAUTH_COMPAT_FULL_EXEC_ENABLED:'1',
  BYL_MCP_PRODUCTION_OAUTH_ENABLED:'1',
  BYL_MCP_PRODUCTION_OPERATOR_ENABLED:'1',
  BYL_MCP_OPERATOR_CANARY_ENABLED:'1',
  BYL_MCP_OPERATOR_FULL_EXEC_ENABLED:'1'
 });
 const f=openSync('/tmp/byl-mcp-oauth-compat-uat.log','a',0o600);
 const child=spawn('/opt/homebrew/bin/node',['mcp-endpoint.mjs'],{cwd:base,env,detached:true,stdio:['ignore',f,f]});
 child.unref();closeSync(f);
 for(let i=0;i<20;i++){
  await new Promise(resolve=>setTimeout(resolve,200));
  try{
   const r=await fetch('http://127.0.0.1:8797/healthz',{signal:AbortSignal.timeout(1500)});
   if(r.status===200){console.log('CANDIDATE_PID='+child.pid);console.log('LOCAL_HEALTH=PASS');console.log('PUBLIC_TUNNEL=UNCHANGED');return}
  }catch{}
 }
 throw Error('CANDIDATE_FAILED_HEALTH_CHECK');
}
main().catch(error=>{console.error('CANDIDATE_STOPPED='+error.message);process.exitCode=1});
