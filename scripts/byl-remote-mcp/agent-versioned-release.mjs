/**
 * AICC Agent Versioned Release V1 — reproducible OFFLINE candidate packager.
 * No production installation, service control, network, private-key handling,
 * operator policy, process inspection or agent restart code in this module.
 * An unsigned local artifact is never a trusted running-build attestation.
 */
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,readdir,lstat,stat,realpath,rm} from 'node:fs/promises';
import {resolve,relative,sep,join,basename,dirname} from 'node:path';

const SCHEMA='aicc-agent-offline-release-candidate/v1';
const DEVICES=new Set(['us-macmini','china-mac','windows','007windows']);
const COMMIT=/^[0-9a-f]{40}$/;
const RELEASE=/^[a-z][a-z0-9-]{5,63}$/;
const SAFE_FILE=/^[a-z][a-z0-9._-]{0,100}\.mjs$/;
const MANIFEST_FILES=new Set(['package.json','package-lock.json']);
const SHA=/^[0-9a-f]{64}$/;
const LIMIT_BYTES=128*1024;
const MAX_TOTAL=768*1024;
const HEX='hex';
const forbiddenPathParts=/^\.|(?:^|[-_.])(?:secret|credential|token|password|private|backup)(?:[-_.]|$)/i;
const forbiddenSource=[
  /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/i,
  /(?:\b(?:100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])|10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b)/,
  /(?:\/Users\/|\/home\/[A-Za-z0-9_-]+\/|[A-Za-z]:\\(?:Users|ProgramData)\\)/,
  /(?:https?:\/\/)[^\s'"`]*?(?:token|api_key|password|secret)=/i,
  /\b(?:apiKey|bearerToken|clientSecret|privateKeyPem|sshPrivateKey)\s*[:=]\s*['"`][A-Za-z0-9_+\/=-]{18,}/,
];
function error(code){const e=new Error(code);e.code=code;return e;}
function hash(bytes){return createHash('sha256').update(bytes).digest(HEX);}
function plainObject(x){return x!==null&&typeof x==='object'&&!Array.isArray(x) && (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);}
function exactKeys(x,keys){return plainObject(x)&&Object.keys(x).sort().join(',')===keys.slice().sort().join(',');}
function normalizeFilename(n){if(typeof n!=='string'||(!SAFE_FILE.test(n)&&!MANIFEST_FILES.has(n))||n.includes('..')||forbiddenPathParts.test(n)) throw error('UNSAFE_SOURCE_FILENAME');return n;}
function scanner(bytes){
  const source=bytes.toString('utf8');
  if(!Buffer.from(source,'utf8').equals(bytes)) throw error('NONCANONICAL_UTF8_SOURCE');
  if(forbiddenSource.some(re=>re.test(source))) throw error('PRIVATE_TOPOLOGY_OR_SECRET_SOURCE');
}
function coreFrom({deviceId,sourceCommit,reviewedTargetCommit,releaseName,files}){
  if(!DEVICES.has(deviceId)||!COMMIT.test(sourceCommit)||!COMMIT.test(reviewedTargetCommit)||!RELEASE.test(releaseName)||!Array.isArray(files)||files.length===0||files.length>32)
    throw error('BUNDLE_METADATA_INVALID');
  if(files.some(f=>!exactKeys(f,['name','size','sha256'])||normalizeFilename(f.name)!==f.name||!Number.isInteger(f.size)||f.size<1||f.size>LIMIT_BYTES||!SHA.test(f.sha256)))
    throw error('BUNDLE_FILE_MANIFEST_INVALID');
  const names=files.map(f=>f.name);
  if(names.includes('package.json')!==names.includes('package-lock.json')) throw error('UNPINNED_PACKAGE_DEPENDENCIES');
  if(names.join('|')!==names.slice().sort().join('|')||new Set(names).size!==names.length)
    throw error('BUNDLE_FILE_ORDER_INVALID');
  if(files.reduce((sum,f)=>sum+f.size,0)>MAX_TOTAL) throw error('BUNDLE_TOO_LARGE');
  return {schema:SCHEMA,deviceId,releaseName,sourceCommit,reviewedTargetCommit,files};
}
function digestCore(core){return hash(Buffer.from('AICC-AGENT-OFFLINE-BUNDLE-V1\n'+JSON.stringify(core),'utf8'));}
async function inspectSource(dir){
 const children=await readdir(dir,{withFileTypes:true});
 const files=[];
 if(children.length===0||children.length>32)throw error('SOURCE_SET_INVALID');
 for(const entry of children){
  const name=normalizeFilename(entry.name);
  if(!entry.isFile()||entry.isSymbolicLink())throw error('SOURCE_TYPE_DENIED');
  const path=join(dir,name);
  const info=await lstat(path);
  if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||info.size<1||info.size>LIMIT_BYTES)throw error('SOURCE_TYPE_DENIED');
  const bytes=await readFile(path);
  if(bytes.length!==info.size)throw error('SOURCE_RACE_DETECTED');
  scanner(bytes);
  files.push({name,size:bytes.length,sha256:hash(bytes),bytes});
 }
 files.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
 return files;
}
function isContained(root,child){const r=relative(root,child);return r===''||(!r.startsWith('..'+sep)&&r!=='..'&&!r.startsWith(sep));}
/** Write only a brand-new isolated candidate directory; no overwrite mode. */
export async function createOfflineRelease({sourceDir,outputDir,deviceId,sourceCommit,reviewedTargetCommit,releaseName}){
 if(!sourceDir||!outputDir)throw error('PATH_REQUIRED');
 const source=await realpath(resolve(sourceDir));
 const requestedOutput=resolve(outputDir);
 // Resolve parent symlinks before any source/output containment decision.
 const outParent=await realpath(dirname(requestedOutput));
 const output=resolve(outParent,basename(requestedOutput));
 if(isContained(source,output)||isContained(output,source))throw error('SOURCE_OUTPUT_OVERLAP');
 if(!isContained(outParent,output))throw error('OUTPUT_PARENT_INVALID');
 const newFiles=await inspectSource(source);
 const files=newFiles.map(({name,size,sha256})=>({name,size,sha256}));
 const core=coreFrom({deviceId,sourceCommit,reviewedTargetCommit,releaseName,files});
 const buildSha256=digestCore(core);
 const manifest={...core,buildSha256,authority:'UNSIGNED_LOCAL_CANDIDATE',
  executingProcessIdentity:'UNVERIFIED',rollbackBuild:'UNVERIFIED',deployPermission:'NONE'};
 // Own this path only after exclusive creation; never touch a pre-existing release.
 try{await mkdir(output,{recursive:false});}catch{throw error('OUTPUT_MUST_BE_NEW');}
 try{
  await mkdir(join(output,'source'));
  for(const {name,bytes} of newFiles){await writeFile(join(output,'source',name),bytes,{mode:0o444,flag:'wx'});}
  await writeFile(join(output,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o444,flag:'wx'});
  const evidence=await verifyOfflineRelease(output);
  if(!evidence.integrityVerified)throw error('POST_BUILD_VERIFICATION_FAILED');
  return Object.freeze({deviceId,releaseName,buildSha256,fileCount:files.length,...evidence});
 }catch(cause){
  // Failure before final validation cannot leave a release-shaped partial artifact.
  // This directory was exclusively created above and contains only staged files.
  try{await rm(output,{recursive:true,force:true});}catch{throw error('PARTIAL_RELEASE_CLEANUP_FAILED');}
  throw cause;
 }
}
export async function verifyOfflineRelease(dir){
 const root=await realpath(resolve(dir));
 const top=await readdir(root,{withFileTypes:true});
 if(top.length!==2||top.some(e=>!['source','release-manifest.json'].includes(e.name)))throw error('UNEXPECTED_ARTIFACT_CONTENT');
 if(!top.find(e=>e.name==='source')?.isDirectory()||!top.find(e=>e.name==='release-manifest.json')?.isFile())throw error('UNEXPECTED_ARTIFACT_CONTENT');
 const m=JSON.parse(await readFile(join(root,'release-manifest.json'),'utf8'));
 const keys=['schema','deviceId','releaseName','sourceCommit','reviewedTargetCommit','files','buildSha256','authority','executingProcessIdentity','rollbackBuild','deployPermission'];
 if(!exactKeys(m,keys)||m.schema!==SCHEMA||m.authority!=='UNSIGNED_LOCAL_CANDIDATE'||m.executingProcessIdentity!=='UNVERIFIED'||m.rollbackBuild!=='UNVERIFIED'||m.deployPermission!=='NONE'||!SHA.test(m.buildSha256))throw error('MANIFEST_NOT_OFFLINE_CANDIDATE');
 const core=coreFrom(m);
 if(digestCore(core)!==m.buildSha256)throw error('MANIFEST_DIGEST_INVALID');
 const directory=join(root,'source');
 const children=await readdir(directory,{withFileTypes:true});
 if(children.length!==m.files.length)throw error('FILE_COUNT_MISMATCH');
 for(const f of m.files){
  const path=join(directory,f.name);
  const info=await lstat(path);
  if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||info.size!==f.size)throw error('SOURCE_TYPE_DENIED');
  const bytes=await readFile(path);
  scanner(bytes);
  if(hash(bytes)!==f.sha256)throw error('SOURCE_DIGEST_INVALID');
 }
 if(children.some(e=>!e.isFile()||!m.files.some(f=>f.name===e.name)))throw error('UNEXPECTED_SOURCE_FILE');
 return Object.freeze({integrityVerified:true,authority:'NOT_ATTESTED',processVersion:'NOT_PROVED',
  rollback:'NOT_PROVED',agentCanary:'STOP',oauthCanary:'STOP',ownerUat:'OPEN'});
}
export function assessOfflineCandidate(evidence){
 if(!evidence||evidence.integrityVerified!==true)throw error('UNVERIFIED_BUNDLE');
 // Do not accept booleans from user input as runtime identity or rollout authorization.
 return Object.freeze({artifactIntegrity:'PASS',runningVersion:'UNKNOWN',rollback:'UNKNOWN',
   agentOnlyCanary:'STOP',reason:'TRUSTED_RELEASE_OWNER_EVIDENCE_REQUIRED'});
}
export async function cli(argv){
 if(argv.length===2&&argv[0]==='verify')return verifyOfflineRelease(argv[1]);
 if(argv.length===7&&argv[0]==='build')return createOfflineRelease({
   sourceDir:argv[1],outputDir:argv[2],deviceId:argv[3],sourceCommit:argv[4],reviewedTargetCommit:argv[5],releaseName:argv[6]});
 throw error('USAGE: build <audited-source-dir> <new-isolated-output-dir> <device> <source-commit> <reviewed-main-commit> <release-name> | verify <bundle-dir>');
}
if(process.argv[1] && resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 cli(process.argv.slice(2)).then(r=>console.log(JSON.stringify(r,null,2)),e=>{
   console.error(e?.code||'BUNDLE_ERROR');process.exitCode=1;
 });
}
