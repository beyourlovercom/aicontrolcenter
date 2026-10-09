import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeRemoteCall} from './operator-policy.mjs';
const op={kind:'cloudflare-access',canOperate:true};
const safe={command:'hostname',timeout_ms:8000};
test('explicit OAuth operator may run only fixed safe hostname on three devices',()=>{
 for(const id of ['us-macmini','china-mac','windows'])
  assert.deepEqual(authorizeRemoteCall(op,id,'start_process',safe),{name:'start_process',arguments:safe});
});
test('read-only OAuth, missing principal and non-OAuth actors denied',()=>{
 for(const p of [{kind:'cloudflare-access',canOperate:false},null,{kind:'internal',canOperate:true}])
  assert.throws(()=>authorizeRemoteCall(p,'us-macmini','start_process',safe),/OPERATOR_DENIED/);
});
test('unlisted device and tools denied',()=>{
 assert.throws(()=>authorizeRemoteCall(op,'other-device','start_process',safe),/DEVICE_DENIED/);
 for(const name of ['execute_command','read_file','write_file','get_config','read_process_output','remote_call',''])
  assert.throws(()=>authorizeRemoteCall(op,'us-macmini',name,safe),/TOOL_DENIED/);
});
test('injection, writes, alternate shells and extra arguments denied',()=>{
 for(const args of [
  {command:'hostname; echo x'}, {command:'uname -a'},
  {command:'hostname',cwd:'/tmp'}, {command:'hostname',timeout_ms:99999},
  {command:'hostname',timeout_ms:'8000'}, {command:'HOSTNAME'},
  {command:'hostname',shell:'/bin/sh'}, {command:'hostname',env:{SECRET:'x'}},
  {command:'hostname',deviceId:'windows'}, {},null,[],{command:'hostname',timeout_ms:8000,foo:1}
 ])assert.throws(()=>authorizeRemoteCall(op,'us-macmini','start_process',args),/ARGUMENTS_DENIED/);
});
