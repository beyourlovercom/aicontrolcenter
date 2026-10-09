import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeRemoteCall,canExposeRemoteCall} from './operator-policy.mjs';
const enabled={BYL_MCP_STAGING:'1',BYL_MCP_UAT_CANDIDATE:'1',BYL_MCP_OPERATOR_CANARY_ENABLED:'1'};
const op={kind:'cloudflare-access',canOperate:true};
const safe={command:'hostname',timeout_ms:8000};
test('explicit OAuth operator may run only fixed safe hostname on three devices',()=>{
 for(const id of ['us-macmini','china-mac','windows'])
  assert.deepEqual(authorizeRemoteCall(op,id,'start_process',safe,enabled),{name:'start_process',arguments:safe});
});
test('read-only OAuth, missing principal and non-OAuth actors denied',()=>{
 for(const p of [{kind:'cloudflare-access',canOperate:false},null,{kind:'internal',canOperate:true}])
  assert.throws(()=>authorizeRemoteCall(p,'us-macmini','start_process',safe,enabled),/OPERATOR_DENIED/);
});
test('unlisted device and tools denied',()=>{
 assert.throws(()=>authorizeRemoteCall(op,'other-device','start_process',safe,enabled),/DEVICE_DENIED/);
 for(const name of ['execute_command','read_file','write_file','get_config','read_process_output','remote_call',''])
  assert.throws(()=>authorizeRemoteCall(op,'us-macmini',name,safe,enabled),/TOOL_DENIED/);
});
test('injection, writes, alternate shells and extra arguments denied',()=>{
 for(const args of [
  {command:'hostname; echo x'}, {command:'uname -a'},
  {command:'hostname',cwd:'/tmp'}, {command:'hostname',timeout_ms:99999},
  {command:'hostname',timeout_ms:'8000'}, {command:'HOSTNAME'},
  {command:'hostname',shell:'/bin/sh'}, {command:'hostname',env:{SECRET:'x'}},
  {command:'hostname',deviceId:'windows'}, {},null,[],{command:'hostname',timeout_ms:8000,foo:1}
 ])assert.throws(()=>authorizeRemoteCall(op,'us-macmini','start_process',args,enabled),/ARGUMENTS_DENIED/);
});

test('OAuth operator cannot expose remote_call outside explicit candidate with canary switch',()=>{
 for(const env of [{}, {BYL_MCP_STAGING:'1'}, {BYL_MCP_STAGING:'1',BYL_MCP_UAT_CANDIDATE:'1'}, {...enabled,BYL_MCP_OPERATOR_CANARY_ENABLED:'0'}, {...enabled,BYL_MCP_STAGING:'0'}]){
  assert.equal(canExposeRemoteCall(op,env),false);
  assert.throws(()=>authorizeRemoteCall(op,'us-macmini','start_process',safe,env),/OPERATOR_DENIED/);
 }
 assert.equal(canExposeRemoteCall(op,enabled),true);
 assert.equal(canExposeRemoteCall({kind:'cloudflare-access',canOperate:false},enabled),false);
 assert.equal(canExposeRemoteCall({kind:'internal',canOperate:true},{}),true);
});

test('fixed harmless file read requires independent read Canary flag',()=>{
 const readEnv={...enabled,BYL_MCP_OPERATOR_READ_CANARY_ENABLED:'1'};
 for(const id of ['us-macmini','china-mac','windows']){
  const path=id==='windows'?'C:\\Windows\\win.ini':'/etc/hosts';
  assert.deepEqual(authorizeRemoteCall(op,id,'read_file',{path},readEnv),
   {name:'read_file',arguments:{path}});
  assert.throws(()=>authorizeRemoteCall(op,id,'read_file',{path},enabled),/TOOL_DENIED/);
  for(const args of [{path:'/etc/passwd'},{path:path+'/../secret'}, {path,extra:true}, {path,encoding:'utf8'}, {}, null])
   assert.throws(()=>authorizeRemoteCall(op,id,'read_file',args,readEnv),/ARGUMENTS_DENIED/);
 }
 for(const name of ['write_file','edit_block','list_directory','start_process'])
  assert.throws(()=>authorizeRemoteCall(op,'us-macmini',name,{path:'/etc/hosts'},readEnv),/TOOL_DENIED|ARGUMENTS_DENIED/);
});
