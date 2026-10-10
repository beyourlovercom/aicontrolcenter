import test from 'node:test';
import assert from 'node:assert/strict';
import {endpointRouting} from './endpoint-routing.mjs';
test('legacy production and both staging ports remain identical',()=>{
 assert.deepEqual(endpointRouting({}),{port:8792,paths:['/mcp','/__byl_remote_mcp/mcp']});
 assert.deepEqual(endpointRouting({BYL_MCP_STAGING:'1'}),{port:8794,paths:['/mcp','/__byl_remote_mcp/mcp']});
 assert.deepEqual(endpointRouting({BYL_MCP_STAGING:'1',BYL_MCP_UAT_CANDIDATE:'1'}),{port:8795,paths:['/mcp','/__byl_remote_mcp/mcp']});
});
test('OAuth compatibility candidate isolated to 8797 and never serves legacy /mcp',()=>{
 const on={BYL_MCP_OAUTH_COMPAT_CANDIDATE:'1',BYL_MCP_ACCESS_ENABLED:'1',BYL_MCP_PRODUCTION_OAUTH_ENABLED:'1'};
 const candidate=endpointRouting(on);
 assert.equal(candidate.port,8797);
 assert.deepEqual(candidate.paths,['/oauth/mcp']);
 assert.equal(candidate.paths.includes('/mcp'),false);
 assert.equal(candidate.paths.includes('/control/'),false);
 assert.throws(()=>endpointRouting({...on,BYL_MCP_STAGING:'1'}),/CONFLICT/);
 for(const key of ['BYL_MCP_ACCESS_ENABLED','BYL_MCP_PRODUCTION_OAUTH_ENABLED']){
  const off={...on};delete off[key];assert.throws(()=>endpointRouting(off),/REQUIRED/);
 }
 assert.throws(()=>{candidate.paths.push('/mcp')},TypeError);
});
