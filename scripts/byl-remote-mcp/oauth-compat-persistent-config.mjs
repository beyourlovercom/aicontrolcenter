/**
 * BYL OAuth compatibility startup config guard.
 * This module has no side effects. The actual Node MCP runtime is loaded only
 * after a secured, owner-owned configuration file passes every safety gate.
 */
import {readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
const keys=[
  'BYL_MCP_ACCESS_ISSUER','BYL_MCP_ACCESS_AUDIENCE',
  'BYL_MCP_ACCESS_READ_EMAILS','BYL_MCP_ACCESS_OPERATE_EMAILS'
];
const allowedKeys=new Set([
 ...keys,'BYL_MCP_STAGING','BYL_MCP_ACCESS_ENABLED',
 'BYL_MCP_OAUTH_COMPAT_CANDIDATE','BYL_MCP_OAUTH_COMPAT_FULL_EXEC_ENABLED',
 'BYL_MCP_PRODUCTION_OAUTH_ENABLED','BYL_MCP_PRODUCTION_OPERATOR_ENABLED',
 'BYL_MCP_OPERATOR_CANARY_ENABLED','BYL_MCP_OPERATOR_FULL_EXEC_ENABLED'
]);
export function validateOAuthCompatConfig(data){
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('OAUTH_CONFIG_INVALID');
 if(Object.keys(data).some(k=>!allowedKeys.has(k)))throw Error('OAUTH_CONFIG_UNEXPECTED_KEY');
 const required={
  BYL_MCP_STAGING:'0',BYL_MCP_ACCESS_ENABLED:'1',
  BYL_MCP_OAUTH_COMPAT_CANDIDATE:'1',
  BYL_MCP_OAUTH_COMPAT_FULL_EXEC_ENABLED:'1',
  BYL_MCP_PRODUCTION_OAUTH_ENABLED:'1',
  BYL_MCP_PRODUCTION_OPERATOR_ENABLED:'1',
  BYL_MCP_OPERATOR_CANARY_ENABLED:'1',
  BYL_MCP_OPERATOR_FULL_EXEC_ENABLED:'1'
 };
 for(const [k,v] of Object.entries(required))if(data[k]!==v)throw Error('OAUTH_CONFIG_FLAG_INVALID_'+k);
 for(const key of keys)if(typeof data[key]!=='string'||!data[key])throw Error('OAUTH_CONFIG_MISSING_'+key);
 if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(data.BYL_MCP_ACCESS_ISSUER))
  throw Error('OAUTH_CONFIG_ISSUER_INVALID');
 if(!/^[a-f0-9]{64}$/.test(data.BYL_MCP_ACCESS_AUDIENCE))
  throw Error('OAUTH_CONFIG_AUDIENCE_INVALID');
 if(data.BYL_MCP_ACCESS_READ_EMAILS!==data.BYL_MCP_ACCESS_OPERATE_EMAILS)
  throw Error('OAUTH_CONFIG_OWNER_MISMATCH');
 if(!/^[^@,\s]+@[^@,\s]+\.[^@,\s]+$/.test(data.BYL_MCP_ACCESS_OPERATE_EMAILS))
  throw Error('OAUTH_CONFIG_OWNER_LIST_INVALID');
 return Object.freeze({...data});
}
export function loadOAuthCompatConfig(file,{uid=process.getuid?.()}={}){
 const name=resolve(file||'');
 if(!name.startsWith('/Users/')||!name.includes('/.byl-remote-mcp/'))
  throw Error('OAUTH_CONFIG_PATH_DENIED');
 const info=statSync(name);
 if(!info.isFile()||Boolean(info.mode&0o077))throw Error('OAUTH_CONFIG_PERMISSIONS_DENIED');
 if(Number.isInteger(uid)&&info.uid!==uid)throw Error('OAUTH_CONFIG_OWNER_DENIED');
 return validateOAuthCompatConfig(JSON.parse(readFileSync(name,'utf8')));
}
