import {appendFileSync,existsSync,renameSync,statSync} from 'node:fs';

const LOG='/Users/a/.byl-remote-mcp/health.jsonl';
const TARGETS=[
  ['gateway','http://127.0.0.1:8790/healthz'],
  ['us-runner','http://100.94.52.109:8787/v1/status'],
  ['china-agent','http://100.102.15.40:8791/healthz'],
  ['windows-agent','http://100.87.29.56:8791/healthz']
];

function rotate(){
  try{
    if(existsSync(LOG)&&statSync(LOG).size>5*1024*1024){
      renameSync(LOG,LOG+'.'+new Date().toISOString().replace(/[:.]/g,'-'));
    }
  }catch{}
}
async function probe(name,url){
  const started=Date.now();
  try{
    const r=await fetch(url,{signal:AbortSignal.timeout(5000)});
    const text=await r.text();
    return {name,ok:r.ok,status:r.status,latencyMs:Date.now()-started,body:text.slice(0,300)};
  }catch(error){
    return {name,ok:false,status:0,latencyMs:Date.now()-started,error:String(error?.message||error)};
  }
}
rotate();
const results=await Promise.all(TARGETS.map(([n,u])=>probe(n,u)));
appendFileSync(LOG,JSON.stringify({ts:new Date().toISOString(),results})+'\n');
if(results.some(r=>!r.ok))process.exitCode=2;
