import test from 'node:test';
import assert from 'node:assert/strict';
import {runUat} from './uat-mcp-readonly.mjs';

const hosts={
  'us-macmini':'as-Mac-mini.local',
  'china-mac':'amacbook-pro.tail5ca8e5.ts.net',
  'windows':'YST-241030SSD'
};
function mockServer({wrongHostname=false,allowAnonymous=false}={}){
  const calls=[];
  const send=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
  const fetchImpl=async(url,options)=>{
    const path=new URL(url).pathname;
    calls.push({path,headers:options.headers,method:options.method});
    if(path==='/healthz')return send({ok:true});
    if(!allowAnonymous && !options.headers.authorization)return send({jsonrpc:'2.0',error:{code:-32001,message:'Unauthorized'},id:100},401);
    const input=JSON.parse(options.body);
    let result;
    if(input.method==='initialize')result={serverInfo:{name:'mock-byl-mcp',version:'test'}};
    else if(input.method==='tools/list')result={tools:[
      {name:'remote_list_devices'},
      {name:'remote_list_tools'},
      {name:'remote_process_selftest'},
      {name:'remote_call'}
    ]};
    else if(input.method==='tools/call'){
      if(input.params.name==='remote_list_devices'){
        result={content:[{type:'text',text:JSON.stringify(Object.keys(hosts).map(id=>({id,state:'READY'})))}]};
      }else{
        const name=hosts[input.params.arguments.deviceId];
        result={content:[{type:'text',text:JSON.stringify({stdout:wrongHostname?'wrong-host':name})}]};
      }
    }
    return send({jsonrpc:'2.0',id:input.id,result});
  };
  return {calls,fetchImpl};
}
test('complete authenticated UAT only calls fixed read-only MCP tools',async()=>{
  const mock=mockServer();
  const lines=[];
  const token='FAKE_TEST_TOKEN_NOT_A_REAL_CREDENTIAL';
  const result=await runUat({token,fetchImpl:mock.fetchImpl,write:line=>lines.push(line)});
  assert.equal(result.status,'PASS');
  assert.ok(result.checks.every(x=>x.status==='PASS'));
  assert.equal(mock.calls.filter(c=>c.method==='POST').length,7);
  assert.equal(mock.calls.filter(c=>c.headers.authorization).length,6);
  assert.ok(lines.every(line=>!line.includes(token)));
});
test('without credential UAT reports BLOCKED, not PASS',async()=>{
  const mock=mockServer();
  const result=await runUat({fetchImpl:mock.fetchImpl,write:()=>{}});
  assert.equal(result.status,'BLOCKED');
  assert.ok(result.checks.some(x=>x.name==='reject_anonymous_mcp'&&x.status==='PASS'));
  assert.equal(mock.calls.some(c=>c.headers.authorization),false);
});
test('hostname mismatch is a failed UAT',async()=>{
  const mock=mockServer({wrongHostname:true});
  const result=await runUat({token:'fake-test',fetchImpl:mock.fetchImpl,write:()=>{}});
  assert.equal(result.status,'FAIL');
  assert.equal(result.checks.filter(x=>x.name.startsWith('hostname_')&&x.status==='FAIL').length,3);
});
test('anonymous MCP acceptance fails negative-auth check',async()=>{
  const mock=mockServer({allowAnonymous:true});
  const result=await runUat({token:'fake-test',fetchImpl:mock.fetchImpl,write:()=>{}});
  assert.equal(result.status,'FAIL');
  assert.ok(result.checks.some(x=>x.name==='reject_anonymous_mcp'&&x.status==='FAIL'));
});
test('rejects non-TLS nonloopback endpoints',async()=>{
  await assert.rejects(runUat({endpoint:'http://10.0.0.1:8792/mcp',fetchImpl:mockServer().fetchImpl,write:()=>{}}),/HTTP_NOT_LOOPBACK/);
});
test('rejects credentials embedded in URLs',async()=>{
  await assert.rejects(runUat({endpoint:'http://test:secret@127.0.0.1:8792/mcp',fetchImpl:mockServer().fetchImpl,write:()=>{}}),/UNSAFE_URL/);
});
