/**
 * Source-only policy intersection for legacy BYL remote_list_tools.
 * Agent /v1/tools describes CAPABILITY, not an operator's AUTHORITY.
 * A trusted, request-bound private Operator Policy must supply allowed tool
 * *names* for the current principal and device; no caller-supplied allowlist.
 * The existing authorizeRemoteCall remains mandatory at execution time.
 */
const TOOL_NAME=/^[a-z][a-z0-9_]{0,63}$/;
const fail=code=>{throw Object.assign(new Error(code),{code});};

export function filterDiscoveredAgentTools({
  agentReply,principal,deviceId,listAuthorizedRemoteToolNames
}={}){
  if(!principal||typeof principal!=='object'||
     !['internal','cloudflare-access'].includes(principal.kind)||
     principal.canOperate!==true)
    return {tools:[]};
  if(typeof listAuthorizedRemoteToolNames!=='function')
    fail('OPERATOR_DISCOVERY_POLICY_UNAVAILABLE');
  if(typeof deviceId!=='string'||deviceId.length===0||deviceId.length>64)
    fail('OPERATOR_DISCOVERY_DEVICE_INVALID');
  // The resolver must be trusted server-owned configuration, NOT an Agent
  // capability list or a client argument. If unavailable/invalid, fail closed.
  const rawAllowed=listAuthorizedRemoteToolNames(principal,deviceId);
  if(rawAllowed instanceof Promise)
    fail('OPERATOR_DISCOVERY_POLICY_INVALID');
  if(!Array.isArray(rawAllowed)&&!(rawAllowed instanceof Set))
    fail('OPERATOR_DISCOVERY_POLICY_INVALID');
  const allowedItems=[...rawAllowed];
  if(allowedItems.length>128||allowedItems.some(n=>typeof n!=='string'||!TOOL_NAME.test(n)))
    fail('OPERATOR_DISCOVERY_POLICY_INVALID');
  const allowed=new Set(allowedItems);
  if(!agentReply||typeof agentReply!=='object'||!Array.isArray(agentReply.tools)||
     agentReply.tools.length>128)
    fail('OPERATOR_DISCOVERY_AGENT_INVALID');
  const seen=new Set(),visible=[];
  for(const item of agentReply.tools){
    if(!item||typeof item!=='object'||typeof item.name!=='string'||
       !TOOL_NAME.test(item.name)||seen.has(item.name))
      fail('OPERATOR_DISCOVERY_AGENT_INVALID');
    seen.add(item.name);
    if(allowed.has(item.name))visible.push(item);
  }
  // Do not invent authorized names that the Agent does not actually implement.
  return {tools:visible};
}
