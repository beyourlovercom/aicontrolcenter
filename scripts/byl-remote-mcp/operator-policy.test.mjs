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

test('one-directory depth-one operator listing is independently gated',()=>{
 const on={...enabled,BYL_MCP_OPERATOR_LIST_CANARY_ENABLED:'1'};
 const fixtures={
  'us-macmini':'/Users/a/AI/007/AIcontrolcenter',
  'china-mac':'/Users/a/AI/007',
  'windows':'C:\\Windows'
 };
 for(const [id,path] of Object.entries(fixtures)){
  assert.deepEqual(authorizeRemoteCall(op,id,'list_directory',{path,depth:1},on),
   {name:'list_directory',arguments:{path,depth:1}});
  assert.throws(()=>authorizeRemoteCall(op,id,'list_directory',{path},enabled),/TOOL_DENIED/);
  for(const args of [{path:path+'/../'}, {path,depth:2},{path,depth:0},{path,depth:'1'}, {path,extra:true},{path:'/etc'}, {},null])
   assert.throws(()=>authorizeRemoteCall(op,id,'list_directory',args,on),/ARGUMENTS_DENIED/);
 }
 assert.throws(()=>authorizeRemoteCall({kind:'cloudflare-access',canOperate:false},'us-macmini','list_directory',{path:fixtures['us-macmini']},on),/OPERATOR_DENIED/);
});

test('P6-E isolated IO canary permits only exact projects, scratch writes and whoami',()=>{
 const io={...enabled,BYL_MCP_OPERATOR_READ_CANARY_ENABLED:'1',BYL_MCP_OPERATOR_LIST_CANARY_ENABLED:'1',BYL_MCP_OPERATOR_IO_CANARY_ENABLED:'1'};
 const exact={
   'us-macmini':{file:'/Users/a/AI/007/AIcontrolcenter/README.md',scratch:'/tmp/byl-operator-uat-canary-20261009.txt'},
   'china-mac':{file:'/Users/a/AI/007/AIcontrolcenter/README.md',scratch:'/tmp/byl-operator-uat-canary-20261009.txt'},
   'windows':{file:'C:\\Windows\\win.ini',scratch:'C:\\Users\\Public\\Documents\\byl-operator-uat-canary-20261009.txt'}
 };
 const content='BYL_OPERATOR_UAT_V1_20261009\n';
 for(const [id,{file,scratch}] of Object.entries(exact)){
   assert.deepEqual(authorizeRemoteCall(op,id,'read_file',{path:file},io),
     {name:'read_file',arguments:{path:file}});
   assert.deepEqual(authorizeRemoteCall(op,id,'write_file',{path:scratch,content},io),
     {name:'write_file',arguments:{path:scratch,content}});
   assert.deepEqual(authorizeRemoteCall(op,id,'read_file',{path:scratch},io),
     {name:'read_file',arguments:{path:scratch}});
   assert.deepEqual(authorizeRemoteCall(op,id,'start_process',{command:'whoami',timeout_ms:8000},io),
     {name:'start_process',arguments:{command:'whoami',timeout_ms:8000}});
   for(const p of [scratch+'/../sensitive',scratch+'.bak','/etc/passwd','https://example.org/file']){
     assert.throws(()=>authorizeRemoteCall(op,id,'read_file',{path:p},io),/ARGUMENTS_DENIED/);
     assert.throws(()=>authorizeRemoteCall(op,id,'write_file',{path:p,content},io),/ARGUMENTS_DENIED/);
   }
   for(const payload of ['altered','',content+'x']){
     assert.throws(()=>authorizeRemoteCall(op,id,'write_file',{path:scratch,content:payload},io),/ARGUMENTS_DENIED/);
   }
   assert.throws(()=>authorizeRemoteCall(op,id,'write_file',{path:scratch,content,mode:'append'},io),/ARGUMENTS_DENIED/);
   assert.throws(()=>authorizeRemoteCall(op,id,'read_file',{path:file,isUrl:true},io),/ARGUMENTS_DENIED/);
   assert.throws(()=>authorizeRemoteCall(op,id,'start_process',{command:'whoami'},enabled),/ARGUMENTS_DENIED/);
 }
 for(const command of ['bash','powershell','rm -rf /','whoami && id','hostname; whoami'])
  assert.throws(()=>authorizeRemoteCall(op,'us-macmini','start_process',{command},io),/ARGUMENTS_DENIED/);
 assert.throws(()=>authorizeRemoteCall({kind:'cloudflare-access',canOperate:false},'us-macmini',
   'write_file',{path:exact['us-macmini'].scratch,content},io),/OPERATOR_DENIED/);
});

test('P6-F read-only Chrome telemetry probes are exact and China Mac only',()=>{
 const browser={...enabled,BYL_MCP_OPERATOR_BROWSER_READ_CANARY_ENABLED:'1'};
 const probes=[
  "osascript -e 'tell application \"Google Chrome\" to count windows'",
  "osascript -e 'tell application \"Google Chrome\" to count tabs of front window'"
 ];
 for(const command of probes){
  assert.deepEqual(authorizeRemoteCall(op,'china-mac','start_process',{command,timeout_ms:8000},browser),
    {name:'start_process',arguments:{command,timeout_ms:8000}});
  assert.throws(()=>authorizeRemoteCall(op,'china-mac','start_process',{command},enabled),/OPERATOR_ARGUMENTS_DENIED/);
  for(const id of ['us-macmini','windows'])
   assert.throws(()=>authorizeRemoteCall(op,id,'start_process',{command},browser),/OPERATOR_ARGUMENTS_DENIED/);
 }
 for(const command of [
  "osascript -e 'tell application \"Google Chrome\" to close windows'",
  "osascript -e 'tell application \"Google Chrome\" to get URL of active tab'",
  "osascript -e 'tell application \"Google Chrome\" to count windows';whoami",
  "osascript -e 'tell application \"Google Chrome\" to count windows' # comment"
 ])assert.throws(()=>authorizeRemoteCall(op,'china-mac','start_process',{command},browser),/OPERATOR_ARGUMENTS_DENIED/);
 assert.throws(()=>authorizeRemoteCall(op,'china-mac','start_process',{command:probes[0],timeout_ms:8000,cwd:'/tmp'},browser),/OPERATOR_ARGUMENTS_DENIED/);
 assert.throws(()=>authorizeRemoteCall({kind:'cloudflare-access',canOperate:false},'china-mac','start_process',{command:probes[0]},browser),/OPERATOR_DENIED/);
});

test('P7 production Operator remains default-denied until all explicit OAuth flags',()=>{
 const production={
  BYL_MCP_STAGING:'0',
  BYL_MCP_ACCESS_ENABLED:'1',
  BYL_MCP_PRODUCTION_OAUTH_ENABLED:'1',
  BYL_MCP_PRODUCTION_OPERATOR_ENABLED:'1',
  BYL_MCP_OPERATOR_CANARY_ENABLED:'1'
 };
 for(const key of Object.keys(production)){
  const absent={...production};delete absent[key];
  assert.equal(canExposeRemoteCall(op,absent),false,'missing '+key);
  assert.throws(()=>authorizeRemoteCall(op,'us-macmini','start_process',safe,absent),/OPERATOR_DENIED/);
  assert.equal(canExposeRemoteCall(op,{...production,[key]:'0'}),false,'disabled '+key);
 }
 assert.equal(canExposeRemoteCall(op,production),true);
 assert.deepEqual(authorizeRemoteCall(op,'us-macmini','start_process',safe,production),
  {name:'start_process',arguments:safe});
 assert.equal(canExposeRemoteCall({...op,canOperate:false},production),false);
 assert.equal(canExposeRemoteCall({kind:'internal',canOperate:true},{}),true);
 const leakingStaging={...production,BYL_MCP_STAGING:'1'};
 assert.equal(canExposeRemoteCall(op,leakingStaging),false);
 assert.equal(canExposeRemoteCall(op,{...enabled,BYL_MCP_PRODUCTION_OPERATOR_ENABLED:'1'}),true);
 for(const command of ['whoami','echo test','osascript']){
  assert.throws(()=>authorizeRemoteCall(op,'us-macmini','start_process',{command},production),/ARGUMENTS_DENIED/);
 }
});
