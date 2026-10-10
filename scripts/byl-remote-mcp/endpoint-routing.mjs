/** Pure, fail-closed endpoint routing for BYL remote MCP.
 * A production OAuth compatibility candidate MUST NOT bind to port 8792,
 * serve legacy /mcp, or overlap the existing staging routes.
 */
export function endpointRouting(env={}){
 const compat=env.BYL_MCP_OAUTH_COMPAT_CANDIDATE==='1';
 if(compat&&env.BYL_MCP_STAGING==='1')throw Error('OAUTH_COMPAT_STAGING_CONFLICT');
 if(compat&&env.BYL_MCP_ACCESS_ENABLED!=='1')throw Error('OAUTH_COMPAT_ACCESS_REQUIRED');
 if(compat&&env.BYL_MCP_PRODUCTION_OAUTH_ENABLED!=='1')throw Error('OAUTH_COMPAT_EXPLICIT_GATE_REQUIRED');
 return compat
   ? Object.freeze({port:8797,paths:Object.freeze(['/oauth/mcp'])})
   : env.BYL_MCP_STAGING==='1'
     ? Object.freeze({port:env.BYL_MCP_UAT_CANDIDATE==='1'?8795:8794,paths:Object.freeze(['/mcp','/__byl_remote_mcp/mcp'])})
     : Object.freeze({port:8792,paths:Object.freeze(['/mcp','/__byl_remote_mcp/mcp'])});
}
