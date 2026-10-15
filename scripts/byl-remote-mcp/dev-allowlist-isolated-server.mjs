/**
 * Construct a NEW dedicated Dev-only MCP SDK server.
 *
 * Never call registerDevAllowlistMcpHandlers on the production OAuth/DC Server:
 * the SDK low-level setRequestHandler would replace existing tools/list/call.
 * SDK Server class/schema objects are supplied by a separately approved
 * operator runtime; this module opens no port and performs no I/O.
 */
import {registerDevAllowlistMcpHandlers} from './dev-allowlist-mcp-registration.mjs';

const instances=new WeakSet();
const DEV_STATUS='dev_release_status';

export function createIsolatedDevMcpServer({
  Server,ListToolsRequestSchema,CallToolRequestSchema,
  resolvePrincipal,service,authorizeTool,
  allowMutatingTools=false,
}={}){
  if(typeof Server!=='function'||typeof authorizeTool!=='function'||
     typeof resolvePrincipal!=='function'||!service||
     (allowMutatingTools!==true&&allowMutatingTools!==false))
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
    if(request?.name!==DEV_STATUS&&allowMutatingTools!==true)
      return false;
    return (await authorizeTool(request))===true;
  };
  return registerDevAllowlistMcpHandlers({
    server,ListToolsRequestSchema,CallToolRequestSchema,
    resolvePrincipal,service,authorizeTool:scopedAuthorize
  });
}
