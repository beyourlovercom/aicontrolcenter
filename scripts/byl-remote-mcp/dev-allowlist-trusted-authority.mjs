/**
 * Server-owned GitHub/Owner authority adapter for Dev-only release.
 * All dependencies MUST be registered trusted clients, not user-supplied URLs.
 * Owner receipts are issued and persisted outside this library; never self-issue.
 */
const EXPECTED_REPO='beyourlovercom/YBY-Core';
const CHECKS=Object.freeze([
 'Release Package Validation',
 'Andy Core Regression',
 'Newsletter M1 Disposable WordPress MySQL',
 'Inquiry Inbox WordPress MySQL Validation'
]);
function deny(code){throw Object.assign(new Error(code),{code});}
const SHA=/^[a-f0-9]{64}$/;
export function createTrustedDevAuthority({github,approvals,artifacts,clock=Date.now}={}){
 for(const [adapter,methods] of [[github,['getPullRequest','getWorkflowRun','listCommitChecks']],
 [approvals,['getReceipt','canView']],[artifacts,['getImmutableArtifact']]])
  if(!adapter||methods.some(name=>typeof adapter[name]!=='function'))
    deny('AUTHORITY_ADAPTER_MISSING');
 return Object.freeze({
  async attest({action,manifest:m,manifestSha256}={}){
   if(!['prepare','apply','rollback'].includes(action)||m?.environment!=='dev'||
      m?.project!=='byl-wordpress-core'||m?.github?.repo!==EXPECTED_REPO||
      typeof manifestSha256!=='string'||!SHA.test(manifestSha256))
      deny('AUTHORITY_SCOPE_DENIED');
   // Owner approval and external GitHub facts are fetched anew before EACH stage.
   const [receipt,pr,workflow,checks,artifact]=await Promise.all([
    approvals.getReceipt(m.authorizationReceipt),
    github.getPullRequest(EXPECTED_REPO,m.github.prNumber),
    github.getWorkflowRun(EXPECTED_REPO,m.github.ciRunId),
    github.listCommitChecks(EXPECTED_REPO,m.github.commitSha),
    artifacts.getImmutableArtifact({repo:EXPECTED_REPO,commitSha:m.github.commitSha,id:m.artifact.id})
   ]);
   const now=clock();
   if(!receipt||receipt.id!==m.authorizationReceipt||receipt.revoked===true||
      receipt.environment!=='dev'||receipt.project!==m.project||
      receipt.repo!==EXPECTED_REPO||receipt.commitSha!==m.github.commitSha||
      receipt.releaseId!==m.releaseId||receipt.manifestSha256!==manifestSha256||
      !Number.isSafeInteger(receipt.issuedAtMs)||!Number.isSafeInteger(receipt.expiresAtMs)||
      receipt.issuedAtMs>now||receipt.expiresAtMs<=now||
      !Array.isArray(receipt.actions)||!receipt.actions.includes(action))
      deny('OWNER_SCOPE_OR_EXPIRY_DENIED');
   if(!pr||pr.repo!==EXPECTED_REPO||pr.number!==m.github.prNumber||
      pr.headSha!==m.github.commitSha||pr.merged===true||
      !pr.base||typeof pr.base!=='string')
      deny('PR_EXACT_HEAD_DENIED');
   if(!workflow||workflow.id!==m.github.ciRunId||
      workflow.headSha!==m.github.commitSha||workflow.conclusion!=='success'||
      workflow.status!=='completed')
      deny('CI_NOT_SUCCESS');
   if(!Array.isArray(checks)||CHECKS.some(name=>
       !checks.some(check=>check.name===name&&check.headSha===m.github.commitSha&&
        check.conclusion==='success'&&check.status==='completed')))
      deny('REQUIRED_CI_INCOMPLETE');
   const approvedPaths=[...m.files.map(f=>f.path)].sort();
   if(!artifact||artifact.repo!==EXPECTED_REPO||
      artifact.commitSha!==m.github.commitSha||
      artifact.id!==m.artifact.id||artifact.sha256!==m.artifact.sha256||
      !SHA.test(artifact.sha256)||artifact.immutable!==true||
      !Array.isArray(artifact.paths)||artifact.paths.length!==approvedPaths.length||
      [...artifact.paths].sort().some((p,i)=>p!==approvedPaths[i]))
      deny('ARTIFACT_IDENTITY_DENIED');
   if(!Array.isArray(receipt.approvedPaths)||receipt.approvedPaths.length!==approvedPaths.length||
      [...receipt.approvedPaths].sort().some((p,i)=>p!==approvedPaths[i]))
      deny('OWNER_FILES_DENIED');
   return {allowed:true,manifestSha256,headSha:m.github.commitSha,
    ciRunId:m.github.ciRunId,ciConclusion:'success',
    ownerReceiptId:m.authorizationReceipt,artifactSha256:m.artifact.sha256,
    approvedPaths};
  },
  async canView({project,releaseId,principal}={}){
   if(project!=='byl-wordpress-core'||typeof releaseId!=='string'||!principal)
      return false;
   return (await approvals.canView({project,releaseId,principal}))===true;
  }
 });
}
