/** Fail-closed OAuth Operator V1 action policy.
 * The existing internal Bearer client remains backward compatible.
 * OAuth cannot dispatch arbitrary agent tools or shell commands.
 */
export const OPERATOR_DEVICES=Object.freeze(['us-macmini','china-mac','windows']);
export function authorizeRemoteCall(principal,deviceId,name,args){
  if(principal?.kind!=='cloudflare-access'||principal.canOperate!==true)
    throw Error('OPERATOR_DENIED');
  if(!OPERATOR_DEVICES.includes(deviceId))throw Error('OPERATOR_DEVICE_DENIED');
  if(name!=='start_process')throw Error('OPERATOR_TOOL_DENIED');
  if(!args||typeof args!=='object'||Array.isArray(args))throw Error('OPERATOR_ARGUMENTS_DENIED');
  const keys=Object.keys(args);
  if(keys.some(k=>!['command','timeout_ms'].includes(k))||
     args.command!=='hostname'||
     (args.timeout_ms!==undefined&&args.timeout_ms!==8000))
    throw Error('OPERATOR_ARGUMENTS_DENIED');
  return {name:'start_process',arguments:{command:'hostname',timeout_ms:8000}};
}
