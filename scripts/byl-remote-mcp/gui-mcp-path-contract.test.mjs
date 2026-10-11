import test from 'node:test';
import assert from 'node:assert/strict';
import {LEGACY_MCP_PATHS,CHATGPT_OAUTH_MCP_PATH,MCP_PATHS,routeAllowsMcpRequest} from './gui-mcp-path-contract.mjs';
const legacy={ok:true,method:'legacy'};
const owner={ok:true,method:'cloudflare-access',actor:'owner@example.com'};
test('legacy MCP routes remain unchanged',()=>{
 assert.deepEqual([...LEGACY_MCP_PATHS],['/mcp','/__byl_remote_mcp/mcp']);
 assert.deepEqual([...MCP_PATHS],['/mcp','/__byl_remote_mcp/mcp','/chatgpt/mcp']);
 for(const p of LEGACY_MCP_PATHS){assert.equal(routeAllowsMcpRequest(p,legacy),true);assert.equal(routeAllowsMcpRequest(p,owner),true)}
});
test('ChatGPT path does not accept static Bearer token',()=>{
 assert.equal(routeAllowsMcpRequest(CHATGPT_OAUTH_MCP_PATH,legacy),false);
 assert.equal(routeAllowsMcpRequest(CHATGPT_OAUTH_MCP_PATH,owner),true);
 assert.equal(routeAllowsMcpRequest(CHATGPT_OAUTH_MCP_PATH,{ok:false,method:'cloudflare-access'}),false);
 assert.equal(routeAllowsMcpRequest(CHATGPT_OAUTH_MCP_PATH,{ok:true,method:'service'}),false);
});
test('unexpected path is always denied',()=>{
 assert.equal(routeAllowsMcpRequest('/chatgpt/mcp/foo',owner),false);
 assert.equal(routeAllowsMcpRequest('/anywhere',legacy),false);
});
