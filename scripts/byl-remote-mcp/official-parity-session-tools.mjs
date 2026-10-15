/**
 * Named read-only diagnostic tools for the existing DC Operator Policy.
 * No start_process, interact_with_process, force_terminate or kill action.
 */
const IDS=Object.freeze(['us-macmini','china-mac','windows','007windows']);
const OPERATIONS=Object.freeze({dc_list_sessions:'list_sessions',dc_list_processes:'list_processes'});
const fail=code=>({isError:true,content:[{type:'text',text:code}]});
export function registerParitySessionTools({server,z,principal,authorizeRemoteCall,delegate}={}){
 if(typeof server?.registerTool!=='function'||typeof z?.enum!=='function'||
    principal?.kind!=='cloudflare-access'||principal.canOperate!==true||
    typeof authorizeRemoteCall!=='function'||typeof delegate!=='function')
   throw Error('PARITY_SESSION_REGISTRATION_DENIED');
 const names=[];
 for(const [exposed,underlying] of Object.entries(OPERATIONS)){
  server.registerTool(exposed,{
   description:'Read-only '+underlying+' (authorized existing Desktop Commander policy; no process control).',
   inputSchema:{deviceId:z.enum(IDS)}
  },async(input={})=>{
   if(!input||typeof input!=='object'||Array.isArray(input)||
      Object.keys(input).sort().join(',')!=='deviceId'||!IDS.includes(input.deviceId))
     return fail('PARITY_ARGUMENTS_DENIED');
   let action;
   try{
    action=authorizeRemoteCall(principal,input.deviceId,underlying,{});
    if(action?.name!==underlying||!action.arguments||typeof action.arguments!=='object')
      return fail('PARITY_OPERATOR_DENIED');
   }catch{return fail('PARITY_OPERATOR_DENIED');}
   try{
    const result=await delegate({deviceId:input.deviceId,name:underlying,arguments:action.arguments});
    if(result?.isError===true)return fail('PARITY_UPSTREAM_DENIED');
    const value=typeof result?.text==='string'?result.text:typeof result==='string'?result:null;
    if(value===null||value.length>65536)return fail('PARITY_RESPONSE_INVALID');
    return {content:[{type:'text',text:value}]};
   }catch{return fail('PARITY_UPSTREAM_ERROR');}
  });names.push(exposed);
 }
 return Object.freeze(names);
}
