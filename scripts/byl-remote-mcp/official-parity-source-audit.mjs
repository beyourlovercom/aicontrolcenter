/**
 * A4 read-only installed-versus-historic OAuth source provenance audit.
 * Input text is injected by a trusted reviewer; this module never reads
 * production files, phones home, logs URLs/keys, or modifies a service.
 *
 * Only expected four-device 007windows source deltas are normalized away.
 * A PASS means "these four files are source-equivalent modulo this exact
 * allowlist", NOT that code is safe to deploy or that main is reconciled.
 */
const FILES=Object.freeze([
 'mcp-endpoint.mjs','operator-policy.mjs','endpoint-routing.mjs','access-auth.mjs'
]);
const fail=code=>Object.freeze({pass:false,code,files:FILES});
const plain=x=>typeof x==='string'&&x.length>0&&x.length<200000;
const normalize=x=>x.replace(/\r\n/g,'\n').trimEnd();
function replaceExactlyOnce(src,needle,value){
 const one=src.indexOf(needle);
 if(one<0||src.indexOf(needle,one+needle.length)>=0)throw Error('SOURCE_DELTA_NOT_UNIQUE');
 return src.slice(0,one)+value+src.slice(one+needle.length);
}
function normalizePolicy(src){
 let s=src;
 s=replaceExactlyOnce(s,
  "export const OPERATOR_DEVICES=Object.freeze(['us-macmini','china-mac','windows','007windows']);",
  "export const OPERATOR_DEVICES=Object.freeze(['us-macmini','china-mac','windows']);");
 s=replaceExactlyOnce(s,
  "  // 007windows uses the existing OAuth full-exec feature gates and tool allowlist.\n",'');
 s=replaceExactlyOnce(s,
  "    if(deviceId==='007windows')allowed.add('get_config');\n",'');
 return s;
}
function normalizeEndpoint(src){
 const lines=src.split('\n');
 const item=lines.findIndex(x=>/^  '007windows':'[^']+'$/.test(x));
 if(item<0||lines.findIndex((x,i)=>i!==item&&x.includes("'007windows':"))>=0)
  throw Error('TARGET_DELTA_INVALID');
 if(!/^  'windows':'[^']+',$/.test(lines[item-1]))
  throw Error('TARGET_PREDECESSOR_MISMATCH');
 lines[item-1]=lines[item-1].replace(/,$/,'');
 lines.splice(item,1);
 let s=lines.join('\n');
 const oldName="z.enum(['us-macmini','china-mac','windows'])";
 const bounded="z.string().min(1).max(64)";
 const entries=s.split('\n');
 let replaced=0;
 for(let i=0;i<entries.length;i++){
  const line=entries[i];
  if(/^\s*(inputSchema:\{deviceId:|deviceId:)/.test(line)&&line.includes(bounded)){
   entries[i]=line.replace(bounded,oldName);replaced++;
  }
 }
 if(replaced!==3)throw Error('DEVICE_SCHEMA_DELTA_INVALID');
 s=entries.join('\n');
 s=replaceExactlyOnce(s,
  '    // 007windows is subject to the same full-exec operator authorization below.\n','');
 return s;
}
export function auditInstalledOAuthSourceParity({historical,installed}={}){
 if(!historical||!installed||
    FILES.some(n=>!plain(historical[n])||!plain(installed[n])))
  return fail('PARITY_SOURCE_INPUT_INVALID');
 try{
  const expected=Object.fromEntries(FILES.map(f=>[f,normalize(historical[f])]));
  const received=Object.fromEntries(FILES.map(f=>[f,normalize(installed[f])]));
  if(expected['endpoint-routing.mjs']!==received['endpoint-routing.mjs']||
     expected['access-auth.mjs']!==received['access-auth.mjs'])
   return fail('PARITY_AUTH_OR_ROUTE_DRIFT');
  if(normalizePolicy(received['operator-policy.mjs'])!==expected['operator-policy.mjs'])
   return fail('PARITY_OPERATOR_POLICY_DRIFT');
  if(normalizeEndpoint(received['mcp-endpoint.mjs'])!==expected['mcp-endpoint.mjs'])
   return fail('PARITY_MCP_ENTRYPOINT_DRIFT');
  return Object.freeze({
   pass:true,code:'EXPECTED_007WINDOWS_DELTAS_ONLY',
   files:FILES,sourceCount:4,requiresReview:true,
   credentialMaterialIncluded:false
  });
 }catch{
  return fail('PARITY_SOURCE_UNKNOWN_DELTA');
 }
}
