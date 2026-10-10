// Fixed-scope Windows Dev navigation bridge for the self-hosted primary MCP.
// No client-supplied command, URL, path, profile or PID is accepted.
const COMMAND='powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\\Users\\Administrator\\AI\\byl-mcp-backup-v1\\gui-windows-dev-owner-uat.ps1"';
function unpack(response){
 const result=response?.result??response;
 if(typeof result==='string')return result;
 const blocks=result?.content;
 if(!Array.isArray(blocks))return '';
 return blocks.filter(x=>x?.type==='text').map(x=>x.text||'').join('\n');
}
function receipt(body){
 return /WINDOWS_GUI_NAVIGATION_PASS pid=\d+ verified=true/.test(body) &&
        /(?:Process completed with exit code 0|Process finished execution|exit code 0)/i.test(body);
}
export async function guiDevCartHomeCanary(call){
 if(typeof call!=='function')return {ok:false,errorCode:'BRIDGE_UNAVAILABLE'};
 try{
  const out=await call('windows','start_process',{command:COMMAND,timeout_ms:12000});
  let combined=unpack(out);
  if(receipt(combined))return {ok:true,action:'navigate_dev_home',deviceId:'windows',verified:true};
  const match=/Process started with PID (\d+)/.exec(combined);
  if(!match)return {ok:false,errorCode:'GUI_START_NOT_CONFIRMED',verified:false};
  const pid=Number(match[1]);
  if(!Number.isSafeInteger(pid)||pid<=0)return {ok:false,errorCode:'GUI_PROCESS_ID_INVALID',verified:false};
  for(let i=0;i<5;i++){
   const result=await call('windows','read_process_output',{pid,timeout_ms:8000});
   const output=unpack(result);
   combined+='\n'+output;
   if(receipt(combined))return {ok:true,action:'navigate_dev_home',deviceId:'windows',verified:true};
   if(/Process completed with exit code (?!0\b)\d+|Process finished execution/.test(output))
    return {ok:false,errorCode:'GUI_NAVIGATION_FAILED',verified:false};
  }
  return {ok:false,errorCode:'GUI_NAVIGATION_UNVERIFIED',verified:false};
 }catch{
  return {ok:false,errorCode:'GUI_OUTCOME_UNKNOWN',verified:false};
 }
}
export const PRIMARY_GUI_TOOL_NAME='gui_dev_cart_home_canary';
