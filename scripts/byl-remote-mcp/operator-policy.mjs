/** Fail-closed OAuth Operator V1 action policy.
 * The existing internal Bearer client remains backward compatible.
 * OAuth cannot dispatch arbitrary agent tools or shell commands.
 */
export const OPERATOR_DEVICES=Object.freeze(['us-macmini','china-mac','windows']);
export function canExposeRemoteCall(principal,env=process.env){
  if(principal?.kind==='internal')return principal.canOperate===true;
  if(principal?.kind!=='cloudflare-access'||principal.canOperate!==true)return false;
  // Staging remains independently gated. Production is default-denied and
  // requires THREE explicit production-only approvals, not staging flags.
  if(env.BYL_MCP_STAGING==='1')
    return env.BYL_MCP_UAT_CANDIDATE==='1'&&
      env.BYL_MCP_OPERATOR_CANARY_ENABLED==='1';
  return env.BYL_MCP_STAGING==='0'&&
    env.BYL_MCP_ACCESS_ENABLED==='1'&&
    env.BYL_MCP_PRODUCTION_OAUTH_ENABLED==='1'&&
    env.BYL_MCP_PRODUCTION_OPERATOR_ENABLED==='1'&&
    env.BYL_MCP_OPERATOR_CANARY_ENABLED==='1';
}
export function authorizeRemoteCall(principal,deviceId,name,args,env=process.env){
  if(principal?.kind!=='cloudflare-access'||!canExposeRemoteCall(principal,env))
    throw Error('OPERATOR_DENIED');
  if(!OPERATOR_DEVICES.includes(deviceId))throw Error('OPERATOR_DEVICE_DENIED');
  // P6-G Owner-approved full remote DC execution, isolated UAT only.
  // This reuses the device agent's existing 24 tools and its own filesystem,
  // command, process and audit protections; never touches internal Bearer flow.
  const isolatedFullExec=
    env.BYL_MCP_STAGING==='1'&&
    env.BYL_MCP_UAT_CANDIDATE==='1'&&
    env.BYL_MCP_OPERATOR_FULL_EXEC_ENABLED==='1';
  const compatFullExec=
    env.BYL_MCP_STAGING==='0'&&
    env.BYL_MCP_OAUTH_COMPAT_CANDIDATE==='1'&&
    env.BYL_MCP_OAUTH_COMPAT_FULL_EXEC_ENABLED==='1'&&
    env.BYL_MCP_PRODUCTION_OAUTH_ENABLED==='1'&&
    env.BYL_MCP_PRODUCTION_OPERATOR_ENABLED==='1'&&
    env.BYL_MCP_OPERATOR_FULL_EXEC_ENABLED==='1';
  if(isolatedFullExec||compatFullExec){
    if(!args||typeof args!=='object'||Array.isArray(args))
      throw Error('OPERATOR_ARGUMENTS_DENIED');
    const allowed=new Set([
      'read_file','read_multiple_files','write_file','write_pdf',
      'create_directory','list_directory','move_file','start_search',
      'get_more_search_results','stop_search','list_searches','get_file_info',
      'edit_block','start_process','read_process_output',
      'interact_with_process','list_sessions','list_processes',
      'kill_process','get_usage_stats','get_recent_tool_calls'
    ]);
    if(!allowed.has(name))throw Error('OPERATOR_TOOL_DENIED');
    return {name,arguments:args};
  }
  // Opt-in isolated read-only canary; never grants arbitrary file paths.
  // The device agent retains its own filesystem permission enforcement.
  if(name==='read_file'&&env.BYL_MCP_OPERATOR_READ_CANARY_ENABLED==='1'&&env.BYL_MCP_OPERATOR_IO_CANARY_ENABLED!=='1'){
    const fixture=deviceId==='windows'
      ? 'C:\\Windows\\win.ini'
      : '/etc/hosts';
    if(!args||typeof args!=='object'||Array.isArray(args)||
       Object.keys(args).length!==1||args.path!==fixture)
      throw Error('OPERATOR_ARGUMENTS_DENIED');
    return {name:'read_file',arguments:{path:fixture}};
  }
  // Explicit single-directory UAT probe; do not grant arbitrary traversal.
  if(name==='list_directory'&&env.BYL_MCP_OPERATOR_LIST_CANARY_ENABLED==='1'){
    const permittedPath={
      'us-macmini':'/Users/a/AI/007/AIcontrolcenter',
      'china-mac':'/Users/a/AI/007',
      'windows':'C:\\Windows'
    }[deviceId];
    if(!args||typeof args!=='object'||Array.isArray(args)||
       Object.keys(args).some(k=>!['path','depth'].includes(k))||
       Object.keys(args).length<1||args.path!==permittedPath||
       (args.depth!==undefined&&args.depth!==1))
      throw Error('OPERATOR_ARGUMENTS_DENIED');
    return {name:'list_directory',arguments:{path:permittedPath,depth:1}};
  }
  // P6-E owner-approved controlled I/O Canary (staging-only).
  // Exact filenames prevent path traversal, symlink-following through arbitrary
  // directories, read URLs, and access to credentials or unrelated projects.
  if(env.BYL_MCP_OPERATOR_IO_CANARY_ENABLED==='1'){
    const projectFiles={
      'us-macmini':['/Users/a/AI/007/AIcontrolcenter/README.md','/Users/a/AI/007/AIcontrolcenter/package.json'],
      'china-mac':['/Users/a/AI/007/AIcontrolcenter/README.md'],
      'windows':[]
    }[deviceId];
    const scratch={
      'us-macmini':'/tmp/byl-operator-uat-canary-20261009.txt',
      'china-mac':'/tmp/byl-operator-uat-canary-20261009.txt',
      'windows':'C:\\Users\\Public\\Documents\\byl-operator-uat-canary-20261009.txt'
    }[deviceId];
    if(name==='read_file'){
      if(!args||typeof args!=='object'||Array.isArray(args)||
         Object.keys(args).length!==1||
         ![...projectFiles,scratch,deviceId==='windows'?'C:\\Windows\\win.ini':'/etc/hosts'].includes(args.path))
        throw Error('OPERATOR_ARGUMENTS_DENIED');
      return {name:'read_file',arguments:{path:args.path}};
    }
    if(name==='write_file'){
      if(!args||typeof args!=='object'||Array.isArray(args)||
         Object.keys(args).length!==2||
         args.path!==scratch||args.content!=='BYL_OPERATOR_UAT_V1_20261009\n')
        throw Error('OPERATOR_ARGUMENTS_DENIED');
      return {name:'write_file',arguments:{path:scratch,content:args.content}};
    }
  }
  // P6-F: strictly read-only Chrome AppleScript probes, China Mac only.
  // No tab navigation, DOM, profiles, screenshots, cookies or writes.
  if(name==='start_process'&&deviceId==='china-mac'&&
     env.BYL_MCP_OPERATOR_BROWSER_READ_CANARY_ENABLED==='1'){
    const probes=[
      "osascript -e 'tell application \"Google Chrome\" to count windows'",
      "osascript -e 'tell application \"Google Chrome\" to count tabs of front window'"
    ];
    if(args&&typeof args==='object'&&!Array.isArray(args)&&
       Object.keys(args).every(k=>['command','timeout_ms'].includes(k))&&
       probes.includes(args.command)&&
       (args.timeout_ms===undefined||args.timeout_ms===8000))
      return {name:'start_process',arguments:{command:args.command,timeout_ms:8000}};
  }
  if(name!=='start_process')throw Error('OPERATOR_TOOL_DENIED');
  if(!args||typeof args!=='object'||Array.isArray(args))throw Error('OPERATOR_ARGUMENTS_DENIED');
  const keys=Object.keys(args);
  if(keys.some(k=>!['command','timeout_ms'].includes(k))||
     !(['hostname','whoami'].includes(args.command)&&
       (args.command==='hostname'||env.BYL_MCP_OPERATOR_IO_CANARY_ENABLED==='1'))||
     (args.timeout_ms!==undefined&&args.timeout_ms!==8000))
    throw Error('OPERATOR_ARGUMENTS_DENIED');
  return {name:'start_process',arguments:{command:args.command,timeout_ms:8000}};
}
