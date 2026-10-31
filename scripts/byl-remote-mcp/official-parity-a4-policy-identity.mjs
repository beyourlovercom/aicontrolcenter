/**
 * Local, read-only A4 manifest->Operator Policy identity check.
 *
 * Explicitly does NOT assert that the supplied manifest was loaded by the
 * currently running launchd listener. That requires trusted service-owner
 * launch provenance. Does not import or execute private policy code.
 * This pure module is safe to run on synthetic local fixtures in CI.
 */
import {createHash} from 'node:crypto';
import {readFileSync,statSync} from 'node:fs';
import {isAbsolute,join} from 'node:path';

const SHA=/^[0-9a-f]{64}$/i;
const fail=code=>{throw Error(code);};
function secureFile(path){
 if(typeof path!=='string'||!isAbsolute(path)||path.length>1024)
  fail('POLICY_IDENTITY_MANIFEST_INVALID');
 const st=statSync(path);
 if(!st.isFile()||(st.mode&0o077)!==0||
    (typeof process.getuid==='function'&&st.uid!==process.getuid()))
  fail('POLICY_IDENTITY_MANIFEST_INSECURE');
}
export function inspectA4PolicyIdentity({
 manifestFile,inspectedSha256,read=readFileSync,stat=statSync
}={}){
 if(typeof inspectedSha256!=='string'||!SHA.test(inspectedSha256))
  fail('POLICY_IDENTITY_EXPECTED_SHA_REQUIRED');
 if(typeof manifestFile!=='string'||!isAbsolute(manifestFile)||
    manifestFile.length>1024)
  fail('POLICY_IDENTITY_MANIFEST_INVALID');
 // Injections for synthetic tests; standard production reader must meet the
 // same manifest ownership/permissions check used by A4's actual launcher.
 const mstat=stat(manifestFile);
 if(!mstat.isFile()||(mstat.mode&0o077)!==0||
    (typeof process.getuid==='function'&&mstat.uid!==process.getuid()))
  fail('POLICY_IDENTITY_MANIFEST_INSECURE');
 let manifest;
 try{manifest=JSON.parse(read(manifestFile,'utf8'));}
 catch{fail('POLICY_IDENTITY_MANIFEST_INVALID');}
 if(!manifest||typeof manifest!=='object'||Array.isArray(manifest)||
    typeof manifest.runtimeDir!=='string'||!isAbsolute(manifest.runtimeDir)||
    manifest.runtimeDir.length>1024)
  fail('POLICY_IDENTITY_MANIFEST_INVALID');
 const dirStat=stat(manifest.runtimeDir);
 if(!dirStat.isDirectory()||(dirStat.mode&0o077)!==0||
    (typeof process.getuid==='function'&&dirStat.uid!==process.getuid()))
  fail('POLICY_IDENTITY_RUNTIME_DIRECTORY_INSECURE');
 const policyFile=join(manifest.runtimeDir,'operator-policy.mjs');
 const pstat=stat(policyFile);
 if(!pstat.isFile()||pstat.size>200000||
    (typeof process.getuid==='function'&&pstat.uid!==process.getuid()))
  fail('POLICY_IDENTITY_POLICY_INVALID');
 const source=read(policyFile,'utf8');
 if(typeof source!=='string'||source.length>200000)
  fail('POLICY_IDENTITY_POLICY_INVALID');
 const sha=createHash('sha256').update(source).digest('hex');
 // This is a static source hint, NOT a dynamic export verification.
 const looksExported=/\bexport\s+(?:(?:async\s+)?function|const|let|var)\s+listAuthorizedRemoteToolNames\b|\bexport\s*\{[^}]*\blistAuthorizedRemoteToolNames\b[^}]*\}/m.test(source);
 return Object.freeze({
  scope:'SUPPLIED_A4_MANIFEST_ONLY',
  inspectedFileMatchesManifestPolicy:sha===inspectedSha256.toLowerCase(),
  discoveryExportStaticHint:looksExported,
  liveListenerManifestAttested:false,
  canEnableDiscoveryFilter:false
 });
}
