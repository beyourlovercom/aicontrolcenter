import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadNextStepUiPreviewPolicy,parseNextStepUiPreviewPolicy,formatNextStepUiPreviewPolicy} from '../lib/ui-preview-policy-runtime.mjs';

const markdown=readFileSync(new URL('../../docs/00_Governance/AICC-GLOBAL-UI-PREVIEW-FIRST-V1.md',import.meta.url),'utf8');
const mainSha='a'.repeat(40),blobSha='b'.repeat(40);

test('V5 Next-Step loads canonical GPT instruction with verified source provenance',async()=>{
  const calls=[];
  const api=async(path)=>{
    calls.push(path);
    if(path==='repos/beyourlovercom/aicontrolcenter/commits/HEAD')return {sha:mainSha};
    if(path.endsWith('?ref='+mainSha))return {type:'file',sha:blobSha,encoding:'base64',content:Buffer.from(markdown).toString('base64')};
    throw new Error('unexpected GitHub path: '+path);
  };
  const policy=await loadNextStepUiPreviewPolicy({api});
  assert.equal(calls.length,2);
  assert.ok(calls[1].includes('docs/00_Governance/AICC-GLOBAL-UI-PREVIEW-FIRST-V1.md?ref='+mainSha));
  assert.equal(policy.id,'AICC-GLOBAL-UI-PREVIEW-FIRST-V1');
  assert.equal(policy.mainSha,mainSha);
  assert.match(policy.instruction,/AppBlock/);
  assert.match(policy.instruction,/OWNER_VISUAL_PASS/);
  assert.match(formatNextStepUiPreviewPolicy(policy),/Policy SHA-256/);
});

test('V5 fails closed on a modified, stale or missing global UI policy',async()=>{
  assert.throws(()=>parseNextStepUiPreviewPolicy(markdown.replace(/Status: \x60ACTIVE\x60/,'Status: SUSPENDED'),mainSha,blobSha),error=>error.code==='NEXT_STEP_GLOBAL_UI_PREVIEW_POLICY_UNAVAILABLE');
  assert.throws(()=>parseNextStepUiPreviewPolicy(markdown,'unknown',blobSha),error=>error.code==='NEXT_STEP_GLOBAL_UI_PREVIEW_POLICY_UNAVAILABLE');
  await assert.rejects(loadNextStepUiPreviewPolicy({api:async()=>{throw new Error('offline');}}),error=>error.code==='NEXT_STEP_GLOBAL_UI_PREVIEW_POLICY_UNAVAILABLE');
});

test('canonical policy includes visual Owner gate distinct from functional UAT and deployment',()=>{
  const p=parseNextStepUiPreviewPolicy(markdown,mainSha,blobSha);
  assert.match(p.instruction,/Visual/);
  assert.match(p.instruction,/functional UAT/);
  assert.match(p.instruction,/Production deployment/);
});
