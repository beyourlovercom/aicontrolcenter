/**
 * DC Dev Deploy V1 — pure, fail-closed contract. Not a registered MCP tool.
 * Project allowlists are server owned, NEVER accepted from an MCP argument.
 */
import {createHash} from 'node:crypto';

export const DEV_PROJECTS=Object.freeze({
  'byl-wordpress-core':Object.freeze({
    repo:'beyourlovercom/YBY-Core',
    files:Object.freeze([
      'wp-content/plugins/yby-core/admin/class-yby-andy-os-navigation.php',
      'wp-content/plugins/yby-core/admin/class-yby-project-studio.php',
      'wp-content/plugins/yby-core/inc/class-yby-core.php'
    ])
  })
});
const SHA256=/^[a-f0-9]{64}$/;
const COMMIT=/^[a-f0-9]{40}$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/;
const PATH=/^wp-content\/plugins\/[a-z0-9-]+\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.(?:php|js|css)$/;
function deny(code){throw Object.assign(new Error(code),{code});}
function plain(v){return v!==null&&typeof v==='object'&&!Array.isArray(v)&&
    (Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);}
function exact(v,ks){if(!plain(v)||Object.keys(v).sort().join('|')!==ks.slice().sort().join('|'))deny('FIELDS_DENIED');}
function positive(v){return Number.isSafeInteger(v)&&v>0;}
export function validateDevManifest(m,registry=DEV_PROJECTS){
  exact(m,['schema','environment','project','releaseId','github','artifact','files','authorizationReceipt','requestId']);
  if(m.schema!==1||m.environment!=='dev')deny('ENVIRONMENT_DENIED');
  if(!Object.hasOwn(registry,m.project))deny('PROJECT_DENIED');
  const cfg=registry[m.project];
  if(!plain(cfg)||typeof cfg.repo!=='string'||!Array.isArray(cfg.files)||cfg.files.length===0)
    deny('REGISTRY_INVALID');
  if(typeof m.releaseId!=='string'||!ID.test(m.releaseId)||typeof m.requestId!=='string'||!ID.test(m.requestId))
    deny('IDENTITY_DENIED');
  if(typeof m.authorizationReceipt!=='string'||!ID.test(m.authorizationReceipt))deny('OWNER_RECEIPT_REQUIRED');
  exact(m.github,['repo','commitSha','prNumber','ciRunId']);
  if(m.github.repo!==cfg.repo||typeof m.github.commitSha!=='string'||!COMMIT.test(m.github.commitSha)||
     !positive(m.github.prNumber)||!positive(m.github.ciRunId))deny('GITHUB_REF_DENIED');
  exact(m.artifact,['id','sha256']);
  if(typeof m.artifact.id!=='string'||!ID.test(m.artifact.id)||
     typeof m.artifact.sha256!=='string'||!SHA256.test(m.artifact.sha256))deny('ARTIFACT_DENIED');
  if(!Array.isArray(m.files)||m.files.length<1||m.files.length>cfg.files.length)deny('FILES_DENIED');
  const seen=new Set();
  for(const f of m.files){
    exact(f,['path','operation','beforeSha256','afterSha256']);
    if(typeof f.path!=='string'||!PATH.test(f.path)||!cfg.files.includes(f.path)||seen.has(f.path))
      deny('PATH_DENIED');
    seen.add(f.path);
    if(f.operation!=='add'&&f.operation!=='replace')deny('OPERATION_DENIED');
    if(f.operation==='add'&&f.beforeSha256!==null)deny('PREIMAGE_DENIED');
    if(f.operation==='replace'&&(typeof f.beforeSha256!=='string'||!SHA256.test(f.beforeSha256)))
      deny('PREIMAGE_DENIED');
    if(typeof f.afterSha256!=='string'||!SHA256.test(f.afterSha256))deny('POSTIMAGE_DENIED');
    if(f.beforeSha256===f.afterSha256)deny('NOOP_DENIED');
  }
  return Object.freeze({
    ...m,
    files:Object.freeze([...m.files].sort((a,b)=>a.path.localeCompare(b.path)).map(f=>Object.freeze({...f}))),
  });
}
export function manifestDigest(m){
  // Hash fields in a canonical order; these values contain no secret material.
  const v=validateDevManifest(m);
  return createHash('sha256').update(JSON.stringify([
    v.schema,v.environment,v.project,v.releaseId,
    v.github.repo,v.github.commitSha,v.github.prNumber,v.github.ciRunId,
    v.artifact.id,v.artifact.sha256,v.authorizationReceipt,
    v.files.map(f=>[f.path,f.operation,f.beforeSha256,f.afterSha256])
  ])).digest('hex');
}
export function assertTrustedAttestation(m,digest,a){
  // The attest() implementation must independently read Owner approvals, GitHub,
  // immutable build artifacts and CI conclusions. Never trust client assertions.
  const paths=m.files.map(f=>f.path);
  if(!plain(a)||a.allowed!==true||a.manifestSha256!==digest||
    a.headSha!==m.github.commitSha||a.ciRunId!==m.github.ciRunId||
    a.ciConclusion!=='success'||a.ownerReceiptId!==m.authorizationReceipt||
    a.artifactSha256!==m.artifact.sha256||!Array.isArray(a.approvedPaths)||
    a.approvedPaths.length!==paths.length||
    a.approvedPaths.some((p,i)=>p!==paths[i]))deny('ATTESTATION_DENIED');
  return true;
}
