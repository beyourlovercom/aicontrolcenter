import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGlobalUiPreviewPolicy, readGlobalUiPreviewPolicy, UI_PREVIEW_POLICY_REPOSITORY, UI_PREVIEW_POLICY_PATH } from '../lib/ui-preview-policy.mjs';

const markdown = readFileSync(new URL('../../docs/00_Governance/AICC-GLOBAL-UI-PREVIEW-FIRST-V1.md', import.meta.url), 'utf8');
const mainSha = 'a'.repeat(40);
const blobSha = 'b'.repeat(40);
const resourcePath = 'repos/' + UI_PREVIEW_POLICY_REPOSITORY + '/contents/' + UI_PREVIEW_POLICY_PATH + '?ref=' + mainSha;

test('canonical governance contract yields a bounded instruction with separate Owner gates', () => {
  const p = parseGlobalUiPreviewPolicy(markdown, { mainSha, blobSha });
  assert.equal(p.id, 'AICC-GLOBAL-UI-PREVIEW-FIRST-V1');
  assert.equal(p.version, 1);
  assert.equal(p.status, 'ACTIVE');
  assert.equal(p.mainSha, mainSha);
  assert.match(p.contentSha256, /^[0-9a-f]{64}$/);
  for (const piece of ['AppBlock', 'OWNER_VISUAL_PASS', 'Production', 'GPT']) assert.match(p.instruction, new RegExp(piece));
  assert.match(markdown, /PREVIEW_WAIVED_BY_OWNER/);
  assert.match(markdown, /PREVIEW_PRESENTED/);
  assert.match(markdown, /FUNCTIONAL_UAT_PASS/);
  assert.match(markdown, /pure backend\/API/);
});

test('policy is read from pinned canonical GitHub SHA, never from selected project', async () => {
  const seen = [];
  const client = { api: async (path) => {
    seen.push(path);
    if (path === 'repos/beyourlovercom/aicontrolcenter/commits/HEAD') return { sha:mainSha };
    if (path === resourcePath) return { type:'file', encoding:'base64', content:Buffer.from(markdown).toString('base64'), sha:blobSha };
    throw new Error('unexpected path');
  } };
  const p = await readGlobalUiPreviewPolicy(client);
  assert.deepEqual(seen, ['repos/beyourlovercom/aicontrolcenter/commits/HEAD', resourcePath]);
  assert.equal(p.canonicalRepository, UI_PREVIEW_POLICY_REPOSITORY);
  assert.equal(p.canonicalPath, UI_PREVIEW_POLICY_PATH);
});

test('invalid policy status or missing instruction fails closed', () => {
  assert.throws(() => parseGlobalUiPreviewPolicy(markdown.replace(/Status: \x60ACTIVE\x60/, 'Status: DRAFT'), { mainSha, blobSha }), /policy status/);
  assert.throws(() => parseGlobalUiPreviewPolicy(markdown.replace('## GPT Context Instruction', '## Old Context Instruction'), { mainSha, blobSha }), /missing or oversized/);
  assert.throws(() => parseGlobalUiPreviewPolicy(markdown, { mainSha: 'unknown', blobSha }), /unverified/);
});

test('missing GitHub file never uses a local fallback', async () => {
  await assert.rejects(readGlobalUiPreviewPolicy({ api: async () => { throw new Error('unavailable'); } }), (e) => e.code === 'GLOBAL_UI_PREVIEW_POLICY_UNAVAILABLE');
});
