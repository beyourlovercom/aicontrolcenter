/**
 * G1 ONLY: construct a fresh, zero-I/O, status-only MCP SDK server.
 * This module opens no port and does not touch the existing OAuth/DC server.
 * No client-supplied or operator-supplied release service can be injected here.
 * G2/G3 write capabilities require a separate, reviewed future entrypoint.
 */
import {registerDevAllowlistMcpHandlers} from './dev-allowlist-mcp-registration.mjs';
import {createG1StatusOnlyService} from './dev-allowlist-g1-status-service.mjs';

const instances=new WeakSet();
const DEV_STATUS='dev_release_status';
const INPUT_KEYS=new Set(['Server','ListToolsRequestSchema','CallToolRequestSchema',
 'resolvePrincipal','authorizeTool']);

export function createIsolatedDevMcpServer(options={}){
 if(!options||typeof options!=='object'||Array.isArray(options)||
    Object.keys(options).some(key=>!INPUT_KEYS.has(key)))
    throw Error('G1_MUTATING_CONFIGURATION_DENIED');
 const {Server,ListToolsRequestSchema,CallToolRequestSchema,
  resolvePrincipal,authorizeTool}=options;
 if(typeof Server!=='function'||typeof authorizeTool!=='function'||
    typeof resolvePrincipal!=='function'||!ListToolsRequestSchema||
    !CallToolRequestSchema)
    throw Error('ISOLATED_DEV_MCP_NOT_CONFIGURED');

 const server=new Server(
  {name:'aicc-dev-deployment-isolated',version:'0.1.0'},
  {capabilities:{tools:{}}}
 );
 if(!server||typeof server.setRequestHandler!=='function'||
    instances.has(server))
    throw Error('MCP_SERVER_NOT_FRESH');
 instances.add(server);
 const scopedAuthorize=async request=>{
  if(request?.name!==DEV_STATUS)return false;
  return (await authorizeTool(request))===true;
 };
 return registerDevAllowlistMcpHandlers({
  server,ListToolsRequestSchema,CallToolRequestSchema,
  resolvePrincipal,service:createG1StatusOnlyService(),
  authorizeTool:scopedAuthorize
 });
}
