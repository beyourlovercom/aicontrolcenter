/**
 * A4.1 service release eligibility assessment — PURE, read-only, no I/O.
 * Consumes operator-verified *metadata*, never accesses secrets or devices.
 * Does not authorize deployment, merge, new features or service restarts.
 */
const DEVICES=Object.freeze(['us-macmini','china-mac','windows','007windows']);
const LEGACY=Object.freeze([
 'remote_list_devices','remote_list_tools','remote_call','remote_process_selftest'
]);
const SHA=/^[a-f0-9]{40}$/;
const isStamp=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const exact=(values,expected)=>Array.isArray(values)&&
 values.length===expected.length&&
 new Set(values).size===expected.length&&expected.every(n=>values.includes(n));
function reviewed(e){
 const blockers=[];
 const need=(condition,code)=>{if(!condition)blockers.push(code);};
 if(!e||typeof e!=='object'||Array.isArray(e)){
  return Object.freeze({status:'BLOCKED',blockers:['EVIDENCE_MISSING'],
   canDeploy:false,requiresSeparateOwnerReleaseApproval:true});
 }
 const repo=e.repo||{},svc=e.service||{},roll=e.rollback||{},access=e.access||{};
 const ci=e.ci||{},dev=e.devices||{};
 need(SHA.test(repo.mainSha||'')&&SHA.test(repo.reviewedSha||'')&&
  repo.mainSha===repo.reviewedSha,'GITHUB_EXACT_SHA_NOT_REVIEWED');
 need(ci.foundation==='success'&&ci.parity==='success','EXACT_HEAD_CI_UNVERIFIED');
 need(svc.manager==='launchd'&&svc.label==='com.byl.remote-mcp-oauth-compat'&&
  Number.isInteger(svc.pid)&&svc.pid>1&&svc.pid===svc.listenerPid,
  'SERVICE_IDENTITY_NOT_ATTESTED');
 need(svc.host==='127.0.0.1'&&svc.port===8797&&
  svc.path==='/oauth/mcp','OAUTH_ROUTE_NOT_ATTESTED');
 need(svc.healthCode===200&&svc.unauthCode===401,'LEGACY_HTTP_BASELINE_FAILED');
 need(exact(access.legacyNames,LEGACY)&&access.newDirectCount===0,
  'LEGACY_MCP_INVENTORY_DRIFT');
 need(exact(Object.keys(dev),DEVICES)&&
  DEVICES.every(id=>dev[id]?.hostnameObserved===true),
  'FOUR_DEVICE_READONLY_BASELINE_MISSING');
 // Rollback must cover the current installation (not just an older version).
 // Merely seeing an old file in a backup directory is not enough.
 need(isStamp(svc.runtimeModifiedAt)&&isStamp(roll.createdAt)&&
  Date.parse(roll.createdAt)>=Date.parse(svc.runtimeModifiedAt),
  'CURRENT_RUNTIME_SNAPSHOT_MISSING');
 need(SHA.test(roll.sha256?.slice(0,40)||'')&&
  /^[a-f0-9]{64}$/.test(roll.sha256||'')&&
  roll.sha256===svc.runtimeSha256,
  'ROLLBACK_BYTES_NOT_VERIFIED');
 need(roll.restoreRehearsalVerified===true&&roll.privateStorage===true,
  'PRIVATE_ROLLBACK_NOT_REHEARSED');
 need(e.privateConfigVerified===true&&e.operatorPolicyVerified===true,
  'SERVICE_PRIVATE_BINDINGS_NOT_VERIFIED');
 need(e.ownerExactReleaseApproval===true,'EXACT_RELEASE_APPROVAL_NOT_RECORDED');
 const status=blockers.length?'BLOCKED':'READY_FOR_HUMAN_RELEASE_REVIEW';
 return Object.freeze({status,blockers:Object.freeze(blockers),
   canDeploy:false,requiresSeparateOwnerReleaseApproval:true,
   scopedDevices:DEVICES,legacyToolCount:LEGACY.length});
}
export const evaluateA4ServicePreflight=reviewed;
