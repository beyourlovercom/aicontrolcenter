/** Fail-closed OAuth Operator V1 action policy.
 * The existing internal Bearer client remains backward compatible.
 * OAuth cannot dispatch arbitrary agent tools or shell commands.
 */
export const OPERATOR_DEVICES=Object.freeze(['us-macmini','china-mac','windows']);
export function canExposeRemoteCall(principal,env=process.env){
  if(principal?.kind==='internal')return principal.canOperate===true;
  return principal?.kind==='cloudflare-access'&&principal.canOperate===true&&
    env.BYL_MCP_STAGING==='1'&&env.BYL_MCP_UAT_CANDIDATE==='1'&&
    env.BYL_MCP_OPERATOR_CANARY_ENABLED==='1';
}
export function authorizeRemoteCall(principal,deviceId,name,args,env=process.env){
  if(principal?.kind!=='cloudflare-access'||!canExposeRemoteCall(principal,env))
    throw Error('OPERATOR_DENIED');
  if(!OPERATOR_DEVICES.includes(deviceId))throw Error('OPERATOR_DEVICE_DENIED');
  // Opt-in isolated read-only canary; never grants arbitrary file paths.
  // The device agent retains its own filesystem permission enforcement.
  if(name==='read_file'&&env.BYL_MCP_OPERATOR_READ_CANARY_ENABLED==='1'){
    const fixture=deviceId==='windows'
      ? 'C:\\Windows\\win.ini'
      : '/etc/hosts';
    if(!args||typeof args!=='object'||Array.isArray(args)||
       Object.keys(args).length!==1||args.path!==fixture)
      throw Error('OPERATOR_ARGUMENTS_DENIED');
    return {name:'read_file',arguments:{path:fixture}};
  }
  if(name!=='start_process')throw Error('OPERATOR_TOOL_DENIED');
  if(!args||typeof args!=='object'||Array.isArray(args))throw Error('OPERATOR_ARGUMENTS_DENIED');
  const keys=Object.keys(args);
  if(keys.some(k=>!['command','timeout_ms'].includes(k))||
     args.command!=='hostname'||
     (args.timeout_ms!==undefined&&args.timeout_ms!==8000))
    throw Error('OPERATOR_ARGUMENTS_DENIED');
  return {name:'start_process',arguments:{command:'hostname',timeout_ms:8000}};
}
