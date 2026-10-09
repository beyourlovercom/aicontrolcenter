/** P6-G isolated Operator switch. US Mac mini localhost 8795 only.
 * Run only after explicit Owner approval, exact-head tests and source staging.
 * Never changes production 8792, console 8793, or readonly UAT 8794.
 */
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync,openSync,closeSync} from 'node:fs';
const base='/tmp/byl-mcp-operator-uat-20261009';
const exec=(bin,args)=>execFileSync(bin,args,{encoding:'utf8',maxBuffer:1048576});
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
const keys=[
 'BYL_MCP_STAGING','BYL_MCP_UAT_CANDIDATE',
 'BYL_MCP_OPERATOR_CANARY_ENABLED','BYL_MCP_ACCESS_ENABLED',
 'BYL_MCP_ACCESS_ISSUER','BYL_MCP_ACCESS_AUDIENCE',
 'BYL_MCP_ACCESS_READ_EMAILS','BYL_MCP_ACCESS_OPERATE_EMAILS',
 'BYL_MCP_OPERATOR_READ_CANARY_ENABLED','BYL_MCP_OPERATOR_LIST_CANARY_ENABLED',
 'BYL_MCP_OPERATOR_IO_CANARY_ENABLED',
 'BYL_MCP_OPERATOR_BROWSER_READ_CANARY_ENABLED'
];
function ensureFlag(source){if(!source.includes('BYL_MCP_OPERATOR_FULL_EXEC_ENABLED'))throw Error('FULL_POLICY_NOT_STAGED');}
async function healthy(){try{const r=await fetch('http://127.0.0.1:8795/healthz',{signal:AbortSignal.timeout(2000)});return r.status===200}catch{return false}}
async function start(env){
 const log=openSync('/tmp/byl-mcp-operator-candidate.log','a',0o600);
 const child=spawn('/opt/homebrew/bin/node',['mcp-endpoint.mjs'],{cwd:base,env,detached:true,stdio:['ignore',log,log]});
 child.unref();closeSync(log);
 for(let i=0;i<20;i++){await sleep(200);if(await healthy())return child.pid}
 throw Error('NEW_CANDIDATE_HEALTH_FAILED');
}
async function main(){
 ensureFlag(readFileSync(base+'/operator-policy.mjs','utf8'));
 exec('/opt/homebrew/bin/node',['--test',base+'/operator-policy.test.mjs']);
 console.log('POLICY_TEST=PASS');
 const pid=Number(exec('/usr/sbin/lsof',['-nP','-iTCP:8795','-sTCP:LISTEN','-Fp']).match(/p(\d+)/)?.[1]);
 if(!Number.isSafeInteger(pid)||pid<=0)throw Error('CANDIDATE_NOT_FOUND');
 const cwd=exec('/usr/sbin/lsof',['-a','-p',String(pid),'-d','cwd','-Fn']);
 if(!cwd.includes('byl-mcp-operator-uat-20261009'))throw Error('WRONG_PROCESS_ROOT');
 const ps=exec('/bin/ps',['eww','-p',String(pid),'-o','command=']);
 const original={...process.env};
 for(const key of keys){
  const match=ps.match(new RegExp('(?:^|\\s)'+key+'=([^\\s]*)'));
  if(!match||!match[1])throw Error('MISSING_CONFIG_'+key);
  original[key]=match[1];
 }
 for(const key of keys.filter(k=>k.includes('CANARY_ENABLED')||['BYL_MCP_STAGING','BYL_MCP_UAT_CANDIDATE','BYL_MCP_ACCESS_ENABLED'].includes(k)))
  if(original[key]!=='1')throw Error('SAFETY_FLAG_MISMATCH_'+key);
 if(original.BYL_MCP_ACCESS_READ_EMAILS!==original.BYL_MCP_ACCESS_OPERATE_EMAILS)throw Error('OWNER_POLICY_MISMATCH');
 console.log('PREDEPLOY_GATE=PASS');
 process.kill(pid,'SIGTERM');
 for(let i=0;i<30;i++){await sleep(100);try{process.kill(pid,0)}catch(e){if(e.code==='ESRCH')break;throw e}}
 try{process.kill(pid,0);throw Error('OLD_CANDIDATE_STILL_RUNNING')}catch(e){if(e.code!=='ESRCH')throw e}
 const upgraded={...original,BYL_MCP_OPERATOR_FULL_EXEC_ENABLED:'1'};
 try{console.log('NEW_PID='+await start(upgraded));console.log('HTTP_STATUS=200');console.log('FULL_EXEC_CANDIDATE=READY')}
 catch(e){
   console.error('UPGRADE_FAILED_ATTEMPTING_ROLLBACK');
   console.log('ROLLBACK_PID='+await start(original));
   console.log('ROLLBACK_HTTP_STATUS=200');
   throw e;
 }
}
main().catch(e=>{console.error('ACTIVATION_STOPPED='+e.message);process.exitCode=1});
