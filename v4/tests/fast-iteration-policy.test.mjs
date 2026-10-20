import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGlobalFastIterationPolicy, readGlobalFastIterationPolicy } from '../lib/fast-iteration-policy.mjs';

const markdown = readFileSync(new URL('../../docs/00_Governance/AICC-GLOBAL-FAST-ITERATION-V1.md', import.meta.url), 'utf8');
const mainSha = 'a'.repeat(40), blobSha = 'b'.repeat(40);
const path = 'repos/beyourlovercom/aicontrolcenter/contents/docs/00_Governance/AICC-GLOBAL-FAST-ITERATION-V1.md?ref=' + mainSha;

test('V4 fast iteration policy is sourced exclusively from pinned canonical GitHub main', async () => {
  const calls = [];
  const client = { api: async (p) => {
    calls.push(p);
    assert.equal(p, path);
    return { type:'file', encoding:'base64', sha:blobSha, content:Buffer.from(markdown).toString('base64') };
  } };
  const policy = await readGlobalFastIterationPolicy(client, {mainSha});
  assert.deepEqual(calls, [path]);
  assert.equal(policy.mainSha, mainSha);
  assert.equal(policy.blobSha, blobSha);
  assert.equal(policy.id, 'AICC-GLOBAL-FAST-ITERATION-V1');
  assert.match(policy.contentSha256, /^[0-9a-f]{64}$/);
  assert.match(policy.instruction, /Owner Dev UAT/);
  assert.match(policy.instruction, /Owner exact-head merge/);
});

test('V4 rejects unknown commit, malformed status, missing instruction and wrong SHA', async () => {
  assert.throws(() => parseGlobalFastIterationPolicy(markdown, {mainSha:'bad',blobSha}), e=>e.code==='GLOBAL_FAST_ITERATION_POLICY_UNAVAILABLE');
  assert.throws(() => parseGlobalFastIterationPolicy(markdown.replace('Status: `ACTIVE`','Status: `DRAFT`'), {mainSha,blobSha}), e=>e.code==='GLOBAL_FAST_ITERATION_POLICY_UNAVAILABLE');
  assert.throws(() => parseGlobalFastIterationPolicy(markdown.replace('## GPT Context Instruction','## Missing'), {mainSha,blobSha}), e=>e.code==='GLOBAL_FAST_ITERATION_POLICY_UNAVAILABLE');
  await assert.rejects(readGlobalFastIterationPolicy({api: async()=>{ throw new Error('should not request HEAD'); }}), e=>e.code==='GLOBAL_FAST_ITERATION_POLICY_UNAVAILABLE');
  await assert.rejects(readGlobalFastIterationPolicy({api: async()=>{ throw new Error('network'); }},{mainSha}), e=>e.code==='GLOBAL_FAST_ITERATION_POLICY_UNAVAILABLE');
});
