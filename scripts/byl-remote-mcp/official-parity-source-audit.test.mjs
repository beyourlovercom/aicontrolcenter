import test from 'node:test';
import assert from 'node:assert/strict';
import {auditInstalledOAuthSourceParity} from './official-parity-source-audit.mjs';

const endpoint=[
 "const TARGETS=Object.freeze({",
 "  'us-macmini':'fixed-dev-us',",
 "  'china-mac':'fixed-dev-cn',",
 "  'windows':'fixed-dev-win'",
 "});",
 "  inputSchema:{deviceId:z.enum(['us-macmini','china-mac','windows'])}",
 "  deviceId:z.enum(['us-macmini','china-mac','windows']),",
 "  inputSchema:{deviceId:z.enum(['us-macmini','china-mac','windows'])}",
 "    if(principal.kind==='cloudflare-access'){",
 "      authorizeRemoteCall(principal,deviceId,name,args||{});",
 "    }",
].join('\n')+'\n';
const policy=[
 "export const OPERATOR_DEVICES=Object.freeze(['us-macmini','china-mac','windows']);",
 "  if(principal.kind!=='cloudflare-access')throw Error('OPERATOR_DENIED');",
 "    const allowed=new Set(['read_file','list_directory','get_file_info']);",
 "    if(!allowed.has(name))throw Error('OPERATOR_TOOL_DENIED');",
].join('\n')+'\n';
const historical={
 'mcp-endpoint.mjs':endpoint,
 'operator-policy.mjs':policy,
 'endpoint-routing.mjs':"export const endpointRouting=()=>'/oauth/mcp';\n",
 'access-auth.mjs':"export const resolveAccessPrincipal=()=>({kind:'cloudflare-access'});\n"
};
function installed(){
 const current={...historical};
 current['mcp-endpoint.mjs']=endpoint
  .replace("  'windows':'fixed-dev-win'\n",
   "  'windows':'fixed-dev-win',\n  '007windows':'fixed-dev-007'\n")
  .replaceAll("z.enum(['us-macmini','china-mac','windows'])",
   "z.string().min(1).max(64)")
  .replace("    if(principal.kind==='cloudflare-access'){",
   "    // 007windows is subject to the same full-exec operator authorization below.\n    if(principal.kind==='cloudflare-access'){");
 current['operator-policy.mjs']=policy
  .replace("['us-macmini','china-mac','windows']","['us-macmini','china-mac','windows','007windows']")
  .replace("    if(!allowed.has(name))",
   "  // 007windows uses the existing OAuth full-exec feature gates and tool allowlist.\n    if(deviceId==='007windows')allowed.add('get_config');\n    if(!allowed.has(name))");
 return current;
}
test('known 007windows deltas only pass; no file contents disclosed in report',()=>{
 const x=auditInstalledOAuthSourceParity({historical,installed:installed()});
 assert.equal(x.pass,true);assert.equal(x.code,'EXPECTED_007WINDOWS_DELTAS_ONLY');
 assert.equal(x.requiresReview,true);
 assert.equal(JSON.stringify(x).includes('fixed-dev-007'),false);
});
test('any OAuth authentication drift rejects even with matched 007 additions',()=>{
 const v=installed();v['access-auth.mjs']+="// unexpected authentication change\n";
 const x=auditInstalledOAuthSourceParity({historical,installed:v});
 assert.equal(x.pass,false);assert.equal(x.code,'PARITY_AUTH_OR_ROUTE_DRIFT');
});
test('route drift is independently rejected',()=>{
 const v=installed();v['endpoint-routing.mjs']=v['endpoint-routing.mjs'].replace('/oauth/mcp','/new-route');
 assert.equal(auditInstalledOAuthSourceParity({historical,installed:v}).code,'PARITY_AUTH_OR_ROUTE_DRIFT');
});
test('unapproved operator authorization change is rejected',()=>{
 const v=installed();v['operator-policy.mjs']=v['operator-policy.mjs'].replace("if(!allowed.has(name))","if(true)");
 assert.equal(auditInstalledOAuthSourceParity({historical,installed:v}).code,'PARITY_OPERATOR_POLICY_DRIFT');
});
test('removal of 007windows, changed schema or new endpoint command cannot pass',()=>{
 const base=installed();
 const variants=[
  {...base,'mcp-endpoint.mjs':base['mcp-endpoint.mjs'].replace("  '007windows':'fixed-dev-007'\n",'')},
  {...base,'mcp-endpoint.mjs':base['mcp-endpoint.mjs'].replace('z.string().min(1).max(64)','z.string()')},
  {...base,'mcp-endpoint.mjs':base['mcp-endpoint.mjs']+"\nserver.registerTool('dc_write_all',{});\n"}
 ];
 for(const item of variants)
  assert.equal(auditInstalledOAuthSourceParity({historical,installed:item}).pass,false);
});
test('credential/source input not present yields safe classification only',()=>{
 const out=auditInstalledOAuthSourceParity({historical,installed:null});
 assert.deepEqual(out.code,'PARITY_SOURCE_INPUT_INVALID');
 assert.equal(JSON.stringify(out).includes('fixed-dev'),false);
});
test('Windows special-case permission cannot be removed silently',()=>{
 const v=installed();
 v['operator-policy.mjs']=v['operator-policy.mjs'].replace("    if(deviceId==='007windows')allowed.add('get_config');\n","");
 assert.equal(auditInstalledOAuthSourceParity({historical,installed:v}).pass,false);
});
