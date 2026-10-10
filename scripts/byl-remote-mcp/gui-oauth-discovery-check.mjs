// Read-only readiness audit. Never follows login redirects or submits credentials.
const base=process.env.CF_MCP_BASE||'https://mcp.beyourlover.com';
if(base!=='https://mcp.beyourlover.com')throw Error('ONLY_PRIMARY_MCP_ALLOWED');
async function probe(path){
 const res=await fetch(base+path,{redirect:'manual',signal:AbortSignal.timeout(9000)});
 let json=null;try{if((res.headers.get('content-type')||'').includes('application/json'))json=await res.json()}catch{}
 return {status:res.status,auth:res.headers.get('www-authenticate')||'',json};
}
const resource=await probe('/.well-known/oauth-protected-resource');
const auth=await probe('/.well-known/oauth-authorization-server');
const mcp=await probe('/mcp');
const okResource=resource.status===200&&Array.isArray(resource.json?.authorization_servers)&&resource.json?.authorization_servers.length>0;
const okAuth=auth.status===200&&typeof auth.json?.authorization_endpoint==='string'&&typeof auth.json?.token_endpoint==='string'
 && auth.json?.code_challenge_methods_supported?.includes('S256');
const challenge=mcp.status===401&&/resource_metadata=|oauth/i.test(mcp.auth);
const ready=Boolean(okResource&&okAuth&&challenge);
console.log(JSON.stringify({ready,resourceStatus:resource.status,authorizationStatus:auth.status,mcpStatus:mcp.status,resourceMetadataOk:okResource,oauthMetadataOk:okAuth,challengeOk:challenge}));
if(!ready)process.exitCode=2;
