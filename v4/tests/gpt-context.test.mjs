import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSuggestedNext, createGptContextSnapshot } from '../lib/gpt-context.mjs';
import { parseGlobalUiPreviewPolicy } from '../lib/ui-preview-policy.mjs';
import { parseGlobalFastIterationPolicy } from '../lib/fast-iteration-policy.mjs';
import { readFileSync } from 'node:fs';

const contract = readFileSync(new URL('../../docs/00_Governance/AICC-GLOBAL-UI-PREVIEW-FIRST-V1.md', import.meta.url), 'utf8');
const uiPreviewPolicy = parseGlobalUiPreviewPolicy(contract, { mainSha:'f'.repeat(40), blobSha:'e'.repeat(40) });
const fastContract = readFileSync(new URL('../../docs/00_Governance/AICC-GLOBAL-FAST-ITERATION-V1.md', import.meta.url), 'utf8');
const fastIterationPolicy = parseGlobalFastIterationPolicy(fastContract, { mainSha:'f'.repeat(40), blobSha:'d'.repeat(40) });

const base = {
  available:true, projectId:'demo', name:'Demo', repository:'owner/repo', defaultBranch:'main', mainSha:'a'.repeat(40),
  roadmap:{ path:'docs/roadmap.md', title:'Demo Roadmap', currentWorkPackage:'WP-1', currentTask:'Task-1', progress:{ available:true, percentage:50, basis:'markdown-checklist', completed:1, total:2 }, currentPointers:{ workPackage:{ value:'WP-1', line:3 }, task:{ value:'Task-1', line:4 } } },
  openPullRequests:[], ownerAttention:[], ci:{ total:1, byStatus:{ completed:1 }, byConclusion:{ success:1 } }, provenance:{ source:'github', repository:'owner/repo', ref:'a'.repeat(40), refreshedAt:'2026-09-07T00:00:00Z' }
};

test('explicit Owner Gate has advisory priority without creating execution authority', () => {
  const next = buildSuggestedNext({ ...base, ownerAttention:[{ type:'HUMAN_UAT', title:'Owner UAT', source:'roadmap', path:'docs/roadmap.md', line:8 }] });
  assert.equal(next.kind, 'OWNER_GATE_RECONCILIATION');
  assert.match(next.text, /Reconcile explicit Owner Gate/);
  assert.doesNotMatch(next.text, /approve|merge now|deploy now/i);
});

test('open PR suggestion requires GitHub reconciliation and never recommends merge', () => {
  const next = buildSuggestedNext({ ...base, roadmap:null, openPullRequests:[{ number:22, title:'Feature', headSha:'b'.repeat(40), updatedAt:'2026-09-07T01:00:00Z' }] });
  assert.equal(next.kind, 'OPEN_PR_RECONCILIATION');
  assert.match(next.reason, /exact head, review state and CI in GitHub/);
  assert.doesNotMatch(next.text, /merge/i);
});

test('Current Task and Current WP outrank unrelated open PR evidence', () => {
  assert.equal(buildSuggestedNext({ ...base, openPullRequests:[{ number:99, title:'Old PR', headSha:'b'.repeat(40) }] }).kind, 'CURRENT_TASK_RECONCILIATION');
  const noTask = { ...base, roadmap:{ ...base.roadmap, currentTask:null, currentPointers:{ ...base.roadmap.currentPointers, task:null } } };
  assert.equal(buildSuggestedNext(noTask).kind, 'CURRENT_WP_RECONCILIATION');
});

test('GPT context copy text preserves GitHub authority and labels runtime as evidence', () => {
  const runtime = { source:'remote-desktop-commander', available:true, observationState:'FRESH_OBSERVATION', observedAt:'2026-09-07T00:00:00Z', machines:[{ id:'cn-mac', name:'CN Mac', role:'Primary Development', status:'ONLINE', projectIds:['demo'], observations:[{ repository:'owner/repo', branch:'feat/demo', runtime:'CLEAN' }] }] };
  const snapshot = createGptContextSnapshot(base, runtime, { now:() => new Date('2026-09-07T00:01:00Z'), uiPreviewPolicy, fastIterationPolicy });
  assert.equal(snapshot.schema, 'aicc.v4.gpt-context.v1');
  assert.equal(snapshot.authority.sourceOfTruth, 'GitHub');
  assert.equal(snapshot.runtime.machines.length, 1);
  assert.match(snapshot.copyText, /GitHub is the only project Source of Truth/);
  assert.match(snapshot.copyText, /Suggested Next \(ADVISORY\)/);
  assert.match(snapshot.copyText, /Before action: reconcile current GitHub evidence/);
  assert.equal(snapshot.uiPreviewPolicy.id, 'AICC-GLOBAL-UI-PREVIEW-FIRST-V1');
  assert.match(snapshot.copyText, /GLOBAL UI PREVIEW FIRST/);
  assert.match(snapshot.copyText, /AppBlock/);
  assert.match(snapshot.copyText, /OWNER_VISUAL_PASS/);
  assert.match(snapshot.copyText, /Production deployment Owner Gates/);
  assert.match(snapshot.copyText, /Policy source: beyourlovercom\/aicontrolcenter/);
  assert.equal(snapshot.fastIterationPolicy.id, 'AICC-GLOBAL-FAST-ITERATION-V1');
  assert.equal(snapshot.fastIterationPolicy.mainSha, snapshot.uiPreviewPolicy.mainSha);
  assert.match(snapshot.copyText, /GLOBAL FAST ITERATION/);
  assert.match(snapshot.copyText, /Owner Dev UAT/);
  assert.match(snapshot.copyText, /Owner exact-head merge/);
});

test('GPT context fails closed if canonical UI preview instruction is absent', () => {
  assert.throws(
    () => createGptContextSnapshot(base, null),
    (error) => error.code === 'GLOBAL_UI_PREVIEW_POLICY_UNAVAILABLE'
  );
});

test('GPT context refuses to omit, mix or downgrade fast iteration policy', () => {
  assert.throws(() => createGptContextSnapshot(base, null, {uiPreviewPolicy}), e => e.code === 'GLOBAL_FAST_ITERATION_POLICY_UNAVAILABLE');
  assert.throws(() => createGptContextSnapshot(base, null, {uiPreviewPolicy,fastIterationPolicy:{...fastIterationPolicy,mainSha:'c'.repeat(40)}}), e => e.code === 'GLOBAL_FAST_ITERATION_POLICY_UNAVAILABLE');
  assert.throws(() => createGptContextSnapshot(base, null, {uiPreviewPolicy,fastIterationPolicy:{...fastIterationPolicy,status:'DRAFT'}}), e => e.code === 'GLOBAL_FAST_ITERATION_POLICY_UNAVAILABLE');
});
