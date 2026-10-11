// New OAuth path intentionally cannot be used by the legacy static Bearer credential.
// Legacy public MCP routes retain their existing auth and behavior.
export const LEGACY_MCP_PATHS=Object.freeze(['/mcp','/__byl_remote_mcp/mcp']);
export const CHATGPT_OAUTH_MCP_PATH='/chatgpt/mcp';
export const MCP_PATHS=Object.freeze([...LEGACY_MCP_PATHS,CHATGPT_OAUTH_MCP_PATH]);

export function routeAllowsMcpRequest(path,decision){
  if(!MCP_PATHS.includes(path)||decision?.ok!==true)return false;
  if(path===CHATGPT_OAUTH_MCP_PATH)return decision.method==='cloudflare-access';
  return decision.method==='legacy'||decision.method==='cloudflare-access';
}
