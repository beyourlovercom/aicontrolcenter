import {readFileSync,appendFileSync,existsSync,statSync,renameSync} from 'node:fs';
import {Client} from '/Users/a/Library/Application Support/AICC/desktop-commander-runtime/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import {StreamableHTTPClientTransport} from '/Users/a/Library/Application Support/AICC/desktop-commander-runtime/node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js';

const LOG='/Users/a/.byl-remote-mcp/cutover-canary.jsonl';
const TOKEN=readFileSync('/Users/a/.byl-remote-mcp/gateway.token','utf8').trim();
const ENDPOINT=new URL('https://mcp.beyourlover.com/mcp');
const DEVICES=['us-macmini','china-mac','windows'];

function rotate(){
  try{
    if(existsSync(LOG)&&statSync(LOG).size>5*1024*1024){
      renameSync(LOG,LOG+'.'+new Date().toISOString().replace(/[:.]/g,'-'));
    }
  }catch{}
}
async function connect(){
  const transport=new StreamableHTTPClientTransport(ENDPOINT,{requestInit:{headers:{Authorization:'Bearer '+TOKEN}}});
  const client=new Client({name:'byl-r9-cutover-canary',version:'1.0.0'},{capabilities:{}});
  await client.connect(transport);
  return client;
}
const started=Date.now();
const record={ts:new Date().toISOString(),ok:false,devices:{}};
let client;
try{
  client=await connect();
  const tools=await client.listTools();
  record.tools=tools.tools.map(t=>t.name);
  for(const deviceId of DEVICES){
    const cfg=await client.callTool({name:'remote_call',arguments:{deviceId,name:'get_config',arguments:{}}});
    const cfgText=JSON.stringify(cfg.content||[]);
    const proc=await client.callTool({name:'remote_process_selftest',arguments:{deviceId}});
    record.devices[deviceId]={
      config:!cfg.isError&&cfgText.includes('0.2.51'),
      process:!proc.isError
    };
  }
  record.ok=DEVICES.every(id=>record.devices[id].config&&record.devices[id].process);
}catch(error){
  record.error=String(error?.message||error);
}finally{
  try{await client?.close();}catch{}
}
record.durationMs=Date.now()-started;
rotate();
appendFileSync(LOG,JSON.stringify(record)+'\n');
if(!record.ok)process.exitCode=2;
