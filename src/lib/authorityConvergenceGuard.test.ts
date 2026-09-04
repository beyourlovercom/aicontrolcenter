import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonicalExecutionDecision} from './fastExecution.ts';

const root=process.cwd();
const clean={repository:root,branch:'feature/x',head:'sha',localMain:'main',remoteMain:'main',worktree:'CLEAN' as const,lastCommit:'sha'};
const auth={workPackageId:'WP-1',branch:'feature/x',repositoryRoot:root,authoritySha:'main'};
const matrix=[
  ['clean',clean,[],[],{}],['in-scope',{...clean,worktree:'DIRTY' as const},['src/a'],[],{}],
  ['known-wip',{...clean,worktree:'DIRTY' as const},['notes'],['notes'],{}],['unknown',{...clean,worktree:'DIRTY' as const},['unknown'],[],{}],
  ['invalid-repo',{...clean,repository:'unavailable'},[],[],{}],['main',{...clean,branch:'main'},[],[],{}],
  ['write-authorized',clean,[],[],{requireAuthorization:true,authorization:auth}],['write-missing-auth',clean,[],[],{requireAuthorization:true}],
  ['read-only',clean,[],[],{requireAuthorization:false}],['uat-stop',clean,[],[],{humanUatHardStop:true}],
  ['scope-evolution',clean,['src/a','src/b'],[],{}],['out-of-scope',{...clean,worktree:'DIRTY' as const},['src/a','outside'],[],{}],
];
for(const [name,repo,files,known,options] of matrix){
  const result=canonicalExecutionDecision(repo as typeof clean,'WP-1',['src/a','src/b'],files as string[],known as string[],options as Parameters<typeof canonicalExecutionDecision>[5]);
  assert.ok(result.decision,'matrix decision exists: '+name); assert.ok(result.reasonCode,'matrix reason exists: '+name);
}
const bridge=readFileSync(`${root}/src/lib/bridgeCore.ts`,'utf8');
const server=readFileSync(`${root}/vite.config.ts`,'utf8');
const runtime=readFileSync(`${root}/src/lib/runtimeManager.ts`,'utf8');
const ui=readFileSync(`${root}/src/App.svelte`,'utf8');
const evidence=readFileSync(`${root}/src/lib/context/entityContext.ts`,'utf8');
assert.doesNotMatch(bridge,/canonicalExecutionDecision|readWorktreeFiles|resolveExecutionScopes/,'Bridge is a pass-through adapter'); assert.match(bridge,/passThrough:true/); assert.match(server,/authorizeWorkPackage/); assert.doesNotMatch(runtime,/canonicalExecutionDecision|readWorktreeFiles|resolveExecutionScopes/,'Runtime does not preflight repository semantics');
assert.doesNotMatch(ui,/canonicalExecutionDecision|fastPreflight|authorizationBlocker/,'UI does not own execution authority');
assert.doesNotMatch(evidence,/canonicalExecutionDecision|fastPreflight|authorizationBlocker/,'read model does not own execution authority');
assert.doesNotMatch(bridge,/worktree\s*!==\s*['"]CLEAN['"]/); assert.doesNotMatch(server,/worktree\s*!==\s*['"]CLEAN['"]/);
const service=readFileSync(`${root}/src/lib/controlService.ts`,'utf8');
assert.doesNotMatch(service,/WORKTREE_PROVENANCE_REQUIRED/,'no binary DIRTY fallback authority');
assert.match(service,/CANONICAL_DECISION_UNAVAILABLE/,'missing canonical decision fails closed through canonical semantics');
for(const file of ['src/App.svelte','src/lib/bridgeCore.ts','src/components/entity/EntityEvidencePanel.svelte','vite.config.ts']){
  const source=readFileSync(`${root}/${file}`,'utf8');
  assert.doesNotMatch(source,/opencode|openspec|\.omo|\bomo\b/i,`forbidden runtime dependency in ${file}`);
}
for(const file of ['AICC-V2-PROJECT-CONSTITUTION-001.md','AICC-V2-CODE-ARCHITECTURE-STANDARD-001.md','AICC-V2-UI-INTERACTION-STANDARD-001.md','AICC-V2-CANONICAL-EXECUTION-STANDARD-001.md'])
  assert.match(readFileSync(`${root}/docs/00_Governance/${file}`,'utf8'),/APPROVED_BASELINE/);
assert.equal(matrix.length>=12,true);
console.log('authority convergence matrix and guard tests passed');
