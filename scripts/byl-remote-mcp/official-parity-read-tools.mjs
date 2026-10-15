/**
 * DC Official Parity V1 — named, read-only MCP operation adapters.
 * Candidate library only: importing this does not modify a running MCP.
 * Preserve the existing OAuth session principal and Operator Policy.
 *
 * A server-owned authorizeRemoteCall MUST reauthorize EACH requested
 * underlying operation. Do not use this module to bypass policy by
 * forwarding an unvalidated generic remote_call command.
 */
export const PARITY_READ_NAMES=Object.freeze({
 dc_read_file:'read_file',
 dc_list_directory:'list_directory',
 dc_get_file_info:'get_file_info'
});
const DEVICE_IDS=Object.freeze(['us-macmini','china-mac','windows','007windows']);
const READ_NAMES=Object.freeze(Object.keys(PARITY_READ_NAMES));
const USER_ERROR=new Set([
 'OPERATOR_DENIED','OPERATOR_DEVICE_DENIED','OPERATOR_TOOL_DENIED',
 'OPERATOR_ARGUMENTS_DENIED','UNREGISTERED_DEVICE','NOT_FOUND',
 'TIMEOUT','UNREACHABLE','AUTH_FAILED'
]);
const err=(code)=>({isError:true,content:[{type:'text',text:code}]});
function safeError(e){
 const code=e?.code||e?.message;
 return USER_ERROR.has(code)?code:'PARITY_OPERATION_FAILED';
}
function fromUpstream(reply){
 if(reply?.isError===true)return err('PARITY_UPSTREAM_DENIED');
 const text=typeof reply?.text==='string'?reply.text:
  typeof reply==='string'?reply:null;
 // Return bounded plain-text only. Untrusted upstream HTML is never executable.
 if(text===null||text.length>65536)return err('PARITY_RESPONSE_INVALID');
 return {content:[{type:'text',text}]};
}
export function registerParityReadTools({
 server,z,principal,authorizeRemoteCall,delegate,allowDevices=DEVICE_IDS
}={}){
 if(typeof server?.registerTool!=='function'||typeof z?.string!=='function'||
    typeof z?.enum!=='function'||typeof authorizeRemoteCall!=='function'||
    typeof delegate!=='function'||!principal||
    !Array.isArray(allowDevices)||allowDevices.length===0||
    allowDevices.some(x=>!DEVICE_IDS.includes(x))||
    new Set(allowDevices).size!==allowDevices.length)
  throw Error('PARITY_READ_REGISTRATION_DENIED');
 if(principal.kind!=='cloudflare-access'||principal.canOperate!==true)
  throw Error('PARITY_UNVERIFIED_PRINCIPAL');
 const schemas={
  dc_read_file:{
   deviceId:z.enum(allowDevices),
   path:z.string().min(1).max(4096),
   offset:z.number().int().min(0).max(1000000).optional(),
   length:z.number().int().min(1).max(300).optional()
  },
  dc_list_directory:{
   deviceId:z.enum(allowDevices),path:z.string().min(1).max(4096),
   depth:z.number().int().min(1).max(3).optional()
  },
  dc_get_file_info:{
   deviceId:z.enum(allowDevices),path:z.string().min(1).max(4096)
  }
 };
 for(const exposed of READ_NAMES){
  const underlying=PARITY_READ_NAMES[exposed];
  server.registerTool(exposed,{
   description:'Read-only '+underlying+' on a specifically authorized connected device; existing OAuth Operator Policy applies.',
   inputSchema:schemas[exposed]
  },async(input={})=>{
   if(!input||typeof input!=='object'||Array.isArray(input))return err('PARITY_ARGS_DENIED');
   const required=exposed==='dc_read_file'?['deviceId','path','offset','length']:
    exposed==='dc_list_directory'?['deviceId','path','depth']:['deviceId','path'];
   if(Object.keys(input).some(k=>!required.includes(k))||
      typeof input.deviceId!=='string'||!allowDevices.includes(input.deviceId)||
      typeof input.path!=='string'||input.path.length<1||input.path.length>4096)
    return err('PARITY_ARGS_DENIED');
   if(exposed==='dc_read_file'&&(
      ('offset'in input&&(!Number.isInteger(input.offset)||input.offset<0||input.offset>1000000))||
      ('length'in input&&(!Number.isInteger(input.length)||input.length<1||input.length>300))))
    return err('PARITY_ARGS_DENIED');
   if(exposed==='dc_list_directory'&&'depth'in input&&
      (!Number.isInteger(input.depth)||input.depth<1||input.depth>3))
    return err('PARITY_ARGS_DENIED');
   const {deviceId,...operationArgs}=input;
   // Reject URL reads at this entrypoint. No file writes or shell operations.
   if(exposed==='dc_read_file'&&/^https?:\/\//i.test(operationArgs.path))
    return err('PARITY_ARGS_DENIED');
   let approved;
   try{
    approved=authorizeRemoteCall(principal,deviceId,underlying,operationArgs);
    if(!approved||approved.name!==underlying||
       !approved.arguments||typeof approved.arguments!=='object')
      return err('OPERATOR_DENIED');
   }catch(e){return err(safeError(e));}
   try{
    const reply=await delegate({deviceId,name:approved.name,arguments:approved.arguments});
    return fromUpstream(reply);
   }catch(e){return err(safeError(e));}
  });
 }
 return Object.freeze([...READ_NAMES]);
}
