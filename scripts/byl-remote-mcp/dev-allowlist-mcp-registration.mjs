/**
 * Isolated MCP SDK registration adapter for a separately authorized DEV sidecar.
 * This does NOT alter the production OAuth MCP server or install a listener.
 * The operator-supplied resolvePrincipal MUST read verified MCP auth context,
 * never params.arguments or any client-controlled principal field.
 */
import {DEV_DEPLOY_TOOL_SPECS,makeDevToolDispatcher} from './dev-allowlist-mcp-tools.mjs';
function deny(code){return {isError:true,content:[{type:'text',text:code}]};}
export function registerDevAllowlistMcpHandlers({
 server,ListToolsRequestSchema,CallToolRequestSchema,resolvePrincipal,
 service,authorizeTool
}={}){
 if(typeof server?.setRequestHandler!=='function'||!ListToolsRequestSchema||
    !CallToolRequestSchema||typeof resolvePrincipal!=='function'||
    typeof authorizeTool!=='function'||!service)
    throw Error('FORMAL_MCP_REGISTRATION_NOT_CONFIGURED');
 const dispatch=makeDevToolDispatcher({service,authorizeTool});
 async function principalFor(requestContext){
  let principal=null;
  try{principal=await resolvePrincipal({requestContext});}catch{}
  return principal;
 }
 async function visible(principal){
  if(!principal)return [];
  const result=[];
  for(const spec of DEV_DEPLOY_TOOL_SPECS){
   let authorized=false;
   try{authorized=await authorizeTool({
    name:spec.name,principal,operation:'list',
    scope:{environment:'dev',project:'byl-wordpress-core'}
   });}catch{}
   if(authorized===true)result.push(spec);
  }
  return result;
 }
 server.setRequestHandler(ListToolsRequestSchema,async(_request,requestContext)=>{
  const principal=await principalFor(requestContext);
  return {tools:await visible(principal)};
 });
 server.setRequestHandler(CallToolRequestSchema,async({params}={},requestContext)=>{
  const principal=await principalFor(requestContext);
  if(!principal)return deny('MCP_AUTH_REQUIRED');
  const allowed=await visible(principal);
  if(!allowed.some(t=>t.name===params?.name))return deny('OPERATOR_AUTH_DENIED');
  return dispatch({name:params.name,arguments:params.arguments,principal});
 });
 return server;
}
