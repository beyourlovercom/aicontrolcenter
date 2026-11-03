/**
 * Read-only D4 activation audit for the separately approved Dev-only MCP.
 *
 * This is NOT an authorization provider and MUST NOT register, install or call
 * any deployment tool. All five snapshots are supplied by independent trusted
 * operator read-only probes, never by an untrusted MCP tool request body.
 */
import {DEV_DEPLOY_TOOL_SPECS} from './dev-allowlist-mcp-tools.mjs';
const MUST_HAVE=Object.freeze(DEV_DEPLOY_TOOL_SPECS.map(x=>x.name));
const SHA=/^[a-f0-9]{40}$/;
function plain(x){return x!==null&&typeof x==='object'&&!Array.isArray(x);}
export function evaluateDevActivation({
  runtime,platform,receiver,authority,release,
}={}){
  const blockers=[];
  if(!plain(runtime)||runtime.sourceRepo!=='beyourlovercom/aicontrolcenter'||
     runtime.sourceRef!=='main'||typeof runtime.commitSha!=='string'||
     !SHA.test(runtime.commitSha)||runtime.sourceParityVerified!==true||
     runtime.productionGatewayUntouched!==true||
     runtime.devOnlyBindingVerified!==true||
     runtime.existingRemoteToolsPreserved!==true||
     runtime.fourDevicePolicyPreserved!==true)
    blockers.push('G1_RUNTIME_PROVENANCE');
  // A registry snapshot is not proof that the client can invoke new actions.
  if(!plain(platform)||platform.formalOAuthVerified!==true||
     platform.ownerActionReviewComplete!==true||
     !Array.isArray(platform.discoveredToolNames)||
     MUST_HAVE.some(name=>!platform.discoveredToolNames.includes(name))||
     !Array.isArray(platform.invokeAuthorizedToolNames)||
     MUST_HAVE.some(name=>!platform.invokeAuthorizedToolNames.includes(name)))
    blockers.push('G1_FORMAL_TOOL_REGISTRATION');
  if(!plain(receiver)||receiver.hostIdentity!=='dev.beyourlover.com'||
     receiver.noGeneralShell!==true||
     receiver.preimageReadOnlyPassed!==true||
     receiver.backupOutsideWebVerified!==true||
     receiver.rollbackVerified!==true||
     receiver.noOtherProjectsWritable!==true)
    blockers.push('G2_DEV_RECEIVER_NOT_VERIFIED');
  if(!plain(authority)||authority.issuerVerified!==true||
     authority.ownerReceiptStoreVerified!==true||
     authority.githubHeadAndCIIndependent!==true||
     authority.artifactImmutableVerified!==true||
     authority.durableLockAndJournalVerified!==true||
     authority.crashRecoveryVerified!==true)
    blockers.push('G2_AUTHORITY_NOT_VERIFIED');
  if(!plain(release)||release.environment!=='dev'||
     release.project!=='byl-wordpress-core'||
     release.ownerCanaryApproved!==true||release.exactPathsAndHashesVerified!==true||
     release.noCommerceOrWWWChanges!==true||release.currentPrHeadAndFourCiPassed!==true)
    blockers.push('G3_CANARY_APPROVAL_MISSING');
  return Object.freeze({
    status:blockers.length===0?'READY_FOR_SEPARATE_CANARY':'BLOCKED',
    blockers:Object.freeze(blockers),
    // These are diagnostic checks, not a command authority or a write receipt.
    canApply:false,
    toolNames:Object.freeze([...MUST_HAVE]),
  });
}


/**
 * G1 staged read-only activation is intentionally independent of G2/G3 release
 * authority, backups and mutating tool registration. It never grants a write.
 * Evidence must be collected by independent trusted operator/client probes.
 */
export function evaluateG1StatusActivation({runtime,platform,statusBackend}={}){
  const blockers=[];
  if(!plain(runtime)||runtime.sourceRepo!=='beyourlovercom/aicontrolcenter'||
     runtime.sourceRef!=='main'||typeof runtime.commitSha!=='string'||
     !SHA.test(runtime.commitSha)||runtime.sourceParityVerified!==true||
     runtime.productionGatewayUntouched!==true||
     runtime.devOnlyBindingVerified!==true||
     runtime.existingRemoteToolsPreserved!==true||
     runtime.fourDevicePolicyPreserved!==true)
    blockers.push('G1_RUNTIME_PROVENANCE');
  // A dedicated G1 application must expose exactly ONE tool; it must not
  // make staged prepare/apply/rollback actions discoverable or invocable.
  const exactlyStatus=(names)=>Array.isArray(names)&&names.length===1&&
    names[0]==='dev_release_status';
  if(!plain(platform)||platform.formalOAuthVerified!==true||
     platform.ownerActionReviewComplete!==true||
     !exactlyStatus(platform.discoveredToolNames)||
     !exactlyStatus(platform.invokeAuthorizedToolNames))
    blockers.push('G1_STATUS_ONLY_TOOL_REGISTRATION');
  // A status handler using the current durable-store.get() is not yet proven
  // read-only: that function initializes on-disk directories on a missing root.
  if(!plain(statusBackend)||statusBackend.noFilesystemMutationsVerified!==true||
     statusBackend.noDevBusinessWritesVerified!==true||
     statusBackend.readAuthorizationVerified!==true)
    blockers.push('G1_STATUS_READ_ONLY_NOT_VERIFIED');
  return Object.freeze({
    status:blockers.length===0?'READY_FOR_STATUS_UAT':'BLOCKED',
    blockers:Object.freeze(blockers),
    canApply:false,
    toolNames:Object.freeze(['dev_release_status']),
  });
}
