import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNextStepFastIterationPolicy, loadNextStepFastIterationPolicy, formatNextStepFastIterationPolicy } from '../lib/fast-iteration-policy-runtime.mjs';

const markdown = readFileSync(new URL('../../docs/00_Governance/AICC-GLOBAL-FAST-ITERATION-V1.md', import.meta.url), 'utf8');
const mainSha = 'a'.repeat(40), blobSha = 'b'.repeat(40);

test('V5 policy uses UI-preview pinned main and includes full governance provenance', async () => {
  const calls=[];
  const api=async path=>{
    calls.push(path);
    assert.equal(path, 'repos/beyourlovercom/aicontrolcenter/contents/docs/00_Governance/AICC-GLOBAL-FAST-ITERATION-V1.md?ref='+mainSha);
    return {type:'file',sha:blobSha,encoding:'base64',content:Buffer.from(markdown).toString('base64')};
  };
  const policy=await loadNextStepFastIterationPolicy({api,mainSha});
  assert.equal(calls.length,1);
  assert.equal(policy.mainSha,mainSha);
  assert.match(formatNextStepFastIterationPolicy(policy,mainSha),/Owner exact-head merge/);
  assert.match(formatNextStepFastIterationPolicy(policy,mainSha),/Policy SHA-256/);
});

test('V5 fails closed on absent, stale or mismatched governance policy', async () => {
  assert.throws(()=>parseNextStepFastIterationPolicy(markdown.replace('Status: `ACTIVE`','Status: `DRAFT`'),mainSha,blobSha),e=>e.code==='NEXT_STEP_GLOBAL_FAST_ITERATION_POLICY_UNAVAILABLE');
  assert.throws(()=>parseNextStepFastIterationPolicy(markdown,'stale',blobSha),e=>e.code==='NEXT_STEP_GLOBAL_FAST_ITERATION_POLICY_UNAVAILABLE');
  const p=parseNextStepFastIterationPolicy(markdown,mainSha,blobSha);
  assert.throws(()=>formatNextStepFastIterationPolicy(p,'c'.repeat(40)),e=>e.code==='NEXT_STEP_GLOBAL_FAST_ITERATION_POLICY_UNAVAILABLE');
  await assert.rejects(loadNextStepFastIterationPolicy({api:async()=>{throw new Error('unavailable');},mainSha}),e=>e.code==='NEXT_STEP_GLOBAL_FAST_ITERATION_POLICY_UNAVAILABLE');
  await assert.rejects(loadNextStepFastIterationPolicy({api:async()=>{throw new Error('unexpected');}}),e=>e.code==='NEXT_STEP_GLOBAL_FAST_ITERATION_POLICY_UNAVAILABLE');
});
