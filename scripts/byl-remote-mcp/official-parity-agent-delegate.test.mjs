import test from 'node:test';
import assert from 'node:assert/strict';
import {createParityAgentDelegate} from './official-parity-agent-delegate.mjs';
const args={deviceId:'007windows',name:'get_file_info',arguments:{path:'C:\\Windows\\win.ini'}};
test('reuses deployed OAuth agentCall result unwrapping with only read operations',async()=>{
 const calls=[];
 const run=createParityAgentDelegate({agentCall:async(...v)=>{
  calls.push(v);return {ok:true,result:{size:92,isFile:true}};
 }});
 const out=await run(args);
 assert.deepEqual(calls,[['007windows','get_file_info',{path:'C:\\Windows\\win.ini'}]]);
 assert.deepEqual(JSON.parse(out.text),{size:92,isFile:true});
});
test('string results and bare object results mirror legacy remote_call text envelope',async()=>{
 const a=createParityAgentDelegate({agentCall:async()=>({result:'safe text'})});
 const b=createParityAgentDelegate({agentCall:async()=>({ok:true,name:'sample'})});
 assert.deepEqual(await a(args),{text:'safe text'});
 assert.equal(JSON.parse((await b(args)).text).name,'sample');
});
test('forbidden arbitrary commands and unexpected host never reach agent transport',async()=>{
 let calls=0;
 const run=createParityAgentDelegate({agentCall:async()=>{calls++;return {result:'x'};}});
 for(const param of [
  {...args,name:'start_process'}, {...args,name:'write_file'},
  {...args,deviceId:'external'}, {...args,arguments:null},
 ]){
  await assert.rejects(run(param),{message:'OPERATOR_ARGUMENTS_DENIED'});
 }
 assert.equal(calls,0);
});
test('upstream explicit error is not presented as a successful file read',async()=>{
 const run=createParityAgentDelegate({agentCall:async()=>({ok:false,result:{secret:'do-not-surface'}})});
 assert.deepEqual(await run(args),{isError:true});
});
test('oversized data never floods downstream tool output',async()=>{
 const run=createParityAgentDelegate({agentCall:async()=>({result:'x'.repeat(70000)})});
 await assert.rejects(run(args),{message:'PARITY_RESPONSE_INVALID'});
});
test('invalid transport or output ceiling fails at constructor',()=>{
 assert.throws(()=>createParityAgentDelegate({}),{message:'PARITY_AGENT_DELEGATE_CONFIG_DENIED'});
 assert.throws(()=>createParityAgentDelegate({agentCall:async()=>({}),maxOutput:100000}),
 {message:'PARITY_AGENT_DELEGATE_CONFIG_DENIED'});
});
