import {createServer} from 'node:http';

export const RESOURCE='https://mcp.beyourlover.com/mcp';
export const DISCOVERY_PATHS=new Set([
  '/.well-known/oauth-protected-resource',
  '/.well-known/oauth-protected-resource/mcp'
]);
export function metadata(issuer,resource=RESOURCE){
  if(resource!==RESOURCE)throw Error('PRODUCTION_RESOURCE_MISMATCH');
  if(typeof issuer!=='string'||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer))
    throw Error('PRODUCTION_AUTH_SERVER_UNVERIFIED');
  return {resource,authorization_servers:[issuer]};
}
export function makeHandler(issuer){
  const body=JSON.stringify(metadata(issuer));
  return (req,res)=>{
    if(req.url==='/healthz'){
      res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
      return res.end(JSON.stringify({ok:true,service:'byl-discovery-only'}));
    }
    if(!DISCOVERY_PATHS.has(req.url)){
      res.writeHead(404,{'cache-control':'no-store'});return res.end();
    }
    if(!['GET','HEAD'].includes(req.method)){
      res.writeHead(405,{'allow':'GET, HEAD','cache-control':'no-store'});return res.end();
    }
    res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'public,max-age=60'});
    return res.end(req.method==='HEAD'?'':body);
  };
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
  const issuer=process.env.BYL_MCP_PROD_OAUTH_AUTHORIZATION_SERVER;
  const handler=makeHandler(issuer); // fails closed if config absent or invalid
  createServer(handler).listen(8796,'127.0.0.1',()=>{
    console.log('BYL metadata-only responder localhost:8796 ready');
  });
}
