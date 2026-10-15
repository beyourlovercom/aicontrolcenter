/**
 * Read-only compatibility shim for the *existing* OAuth endpoint's agentCall.
 *
 * The live remote_call handler calls agentCall(deviceId,name,args), unwraps
 * out.result ?? out, and serializes that result to MCP text. These five
 * explicitly read-only tools reuse exactly that result behavior. No network
 * addresses, credentials, files, or transport instances are configured here.
 */
const READS=new Set([
 'read_file','list_directory','get_file_info','list_sessions','list_processes'
]);
const IDS=new Set(['us-macmini','china-mac','windows','007windows']);
export function createParityAgentDelegate({agentCall,maxOutput=65536}={}){
 if(typeof agentCall!=='function'||!Number.isInteger(maxOutput)||
    maxOutput<1||maxOutput>65536)
  throw Error('PARITY_AGENT_DELEGATE_CONFIG_DENIED');
 return async function delegate({deviceId,name,arguments:args}={}){
  if(!IDS.has(deviceId)||!READS.has(name)||!args||
     typeof args!=='object'||Array.isArray(args))
   throw Object.assign(new Error('OPERATOR_ARGUMENTS_DENIED'),{code:'OPERATOR_ARGUMENTS_DENIED'});
  const out=await agentCall(deviceId,name,args);
  if(out?.ok===false||out?.isError===true)
   return {isError:true};
  const result=out?.result??out;
  let serialized;
  if(typeof result==='string')serialized=result;
  else{
   try{serialized=JSON.stringify(result,null,2);}
   catch{throw Object.assign(new Error('PARITY_RESPONSE_INVALID'),{code:'PARITY_RESPONSE_INVALID'});}
  }
  if(typeof serialized!=='string'||serialized.length>maxOutput)
   throw Object.assign(new Error('PARITY_RESPONSE_INVALID'),{code:'PARITY_RESPONSE_INVALID'});
  return {text:serialized};
 };
}
