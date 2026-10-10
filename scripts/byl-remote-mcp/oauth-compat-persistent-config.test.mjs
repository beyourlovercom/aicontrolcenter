import test from 'node:test';
import assert from 'node:assert/strict';
import {validateOAuthCompatConfig} from './oauth-compat-persistent-config.mjs';
const ready={
 BYL_MCP_STAGING:'0',BYL_MCP_ACCESS_ENABLED:'1',
 BYL_MCP_OAUTH_COMPAT_CANDIDATE:'1',
 BYL_MCP_OAUTH_COMPAT_FULL_EXEC_ENABLED:'1',
 BYL_MCP_PRODUCTION_OAUTH_ENABLED:'1',
 BYL_MCP_PRODUCTION_OPERATOR_ENABLED:'1',
 BYL_MCP_OPERATOR_CANARY_ENABLED:'1',
 BYL_MCP_OPERATOR_FULL_EXEC_ENABLED:'1',
 BYL_MCP_ACCESS_ISSUER:'https://example.cloudflareaccess.com',
 BYL_MCP_ACCESS_AUDIENCE:'a'.repeat(64),
 BYL_MCP_ACCESS_READ_EMAILS:'owner@example.com',
 BYL_MCP_ACCESS_OPERATE_EMAILS:'owner@example.com'
};
test('persistent config accepts exact owner-only gated 8797 setup',()=>{
 const config=validateOAuthCompatConfig(ready);
 assert.deepEqual(config,ready);
 assert.equal(Object.isFrozen(config),true);
});
test('persistent config refuses missing, disabled and extra flags',()=>{
 for(const key of Object.keys(ready)){
  const missing={...ready};delete missing[key];
  assert.throws(()=>validateOAuthCompatConfig(missing),Error,key);
 }
 for(const key of ['BYL_MCP_STAGING','BYL_MCP_ACCESS_ENABLED','BYL_MCP_PRODUCTION_OPERATOR_ENABLED','BYL_MCP_OPERATOR_FULL_EXEC_ENABLED']){
  const invalid={...ready,[key]:'WRONG'};
  assert.throws(()=>validateOAuthCompatConfig(invalid),Error,key);
 }
 assert.throws(()=>validateOAuthCompatConfig({...ready,BYL_MCP_SECRET:'ignored'}),/UNEXPECTED_KEY/);
});
test('reject invalid issuer, audience and mismatched owner list',()=>{
 assert.throws(()=>validateOAuthCompatConfig({...ready,BYL_MCP_ACCESS_ISSUER:'https://evil.example.com'}),/ISSUER_INVALID/);
 assert.throws(()=>validateOAuthCompatConfig({...ready,BYL_MCP_ACCESS_AUDIENCE:'short'}),/AUDIENCE_INVALID/);
 assert.throws(()=>validateOAuthCompatConfig({...ready,BYL_MCP_ACCESS_OPERATE_EMAILS:'other@example.com'}),/OWNER_MISMATCH/);
 assert.throws(()=>validateOAuthCompatConfig({...ready,BYL_MCP_ACCESS_OPERATE_EMAILS:'owner@example.com,other@example.com',BYL_MCP_ACCESS_READ_EMAILS:'owner@example.com,other@example.com'}),/OWNER_LIST_INVALID/);
});
