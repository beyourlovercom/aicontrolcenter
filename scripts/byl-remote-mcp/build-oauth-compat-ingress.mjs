/** Prepare an offline Cloudflare Tunnel ingress candidate for same-host OAuth.
 * No process restart, no Cloudflare API calls, no live config writes.
 */
import {readFileSync,writeFileSync} from 'node:fs';
const [source,destination]=process.argv.slice(2);
if(!source||!destination||source===destination)throw Error('INPUT_OUTPUT_REQUIRED_AND_DISTINCT');
if(!destination.startsWith('/tmp/byl-mcp-'))throw Error('CANDIDATE_OUTPUT_DENIED');
const input=readFileSync(source,'utf8');
const marker='ingress:\n';
if(input.split(marker).length!==2)throw Error('INGRESS_MARKER_INVALID');
if(!input.includes('hostname: mcp.beyourlover.com')||
   !input.includes('service: http://127.0.0.1:8792')||
   !input.includes('service: http://127.0.0.1:8793'))throw Error('BASELINE_GATE_FAILED');
if(input.includes('/oauth/mcp')||input.includes('8797'))throw Error('CANDIDATE_ALREADY_PRESENT');
const candidate=[
 '  - hostname: mcp.beyourlover.com',
 '    path: ^/oauth/mcp$',
 '    service: http://127.0.0.1:8797',
 ''
].join('\n');
const output=input.replace(marker,marker+candidate);
if(!output.includes('service: http://127.0.0.1:8792')||
   !output.includes('service: http://127.0.0.1:8793'))throw Error('ORIGINAL_SERVICES_MISSING');
writeFileSync(destination,output,{flag:'wx',mode:0o600});
console.log('OFFLINE_OAUTH_ROUTE_CREATED='+destination);
