import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';

const run = promisify(execFile);
const REPO = 'beyourlovercom/aicontrolcenter';
const PATH = 'docs/00_Governance/AICC-GLOBAL-UI-PREVIEW-FIRST-V1.md';
const ID = 'AICC-GLOBAL-UI-PREVIEW-FIRST-V1';
const shaPattern = /^[0-9a-f]{40}$/i;

function fail() {
  const error = new Error('Canonical AICC UI preview policy is unavailable, invalid or out of date');
  error.code = 'NEXT_STEP_GLOBAL_UI_PREVIEW_POLICY_UNAVAILABLE';
  throw error;
}

export function validateNextStepUiPreviewPolicy(input) {
  if (input?.id !== ID || input?.status !== 'ACTIVE' || input?.version !== 1) fail();
  if (!shaPattern.test(input?.mainSha || '') || !/^[0-9a-f]{64}$/i.test(input?.contentSha256 || '')) fail();
  if (typeof input?.instruction !== 'string' || !input.instruction.trim() || input.instruction.length > 4000) fail();
  if (!['AppBlock', 'OWNER_VISUAL_PASS', 'Production', 'GPT'].every(t => input.instruction.includes(t))) fail();
  return Object.freeze({
    id: ID, status: 'ACTIVE', version: 1,
    mainSha: input.mainSha, contentSha256: input.contentSha256, instruction: input.instruction
  });
}

export function parseNextStepUiPreviewPolicy(markdown, mainSha, blobSha) {
  if (typeof markdown !== 'string' || Buffer.byteLength(markdown,'utf8') > 16000) fail();
  if (!shaPattern.test(mainSha || '') || !shaPattern.test(blobSha || '')) fail();
  if (!/^Policy-ID: \x60AICC-GLOBAL-UI-PREVIEW-FIRST-V1\x60$/m.test(markdown)) fail();
  if (!/^Policy-Version: \x601\x60$/m.test(markdown) || !/^Status: \x60ACTIVE\x60$/m.test(markdown)) fail();
  const sections = markdown.split(/^## GPT Context Instruction[ \t]*\r?\n/m);
  if (sections.length !== 2) fail();
  const instruction = sections[1].split(/\r?\n## /, 1)[0].trim();
  return validateNextStepUiPreviewPolicy({ id: ID, version: 1, status:'ACTIVE', mainSha,
    contentSha256: createHash('sha256').update(markdown).digest('hex'), instruction });
}

async function ghApi(path) {
  const {stdout} = await run('gh', ['api', path], { timeout: 10000, maxBuffer: 65536 });
  return JSON.parse(stdout);
}

export async function loadNextStepUiPreviewPolicy({ api = ghApi } = {}) {
  try {
    const commit = await api('repos/' + REPO + '/commits/HEAD');
    if (!shaPattern.test(commit?.sha || '')) fail();
    const result = await api('repos/' + REPO + '/contents/' + PATH + '?ref=' + commit.sha);
    if (result?.type !== 'file' || result?.encoding !== 'base64' || !shaPattern.test(result?.sha || '')) fail();
    if (typeof result.content !== 'string' || result.content.length > 25000 ||
      !/^[A-Za-z0-9+/=\s]+$/.test(result.content)) fail();
    const decoded = Buffer.from(result.content.replace(/\s/g,''), 'base64').toString('utf8');
    return parseNextStepUiPreviewPolicy(decoded, commit.sha, result.sha);
  } catch (error) {
    if (error?.code === 'NEXT_STEP_GLOBAL_UI_PREVIEW_POLICY_UNAVAILABLE') throw error;
    fail();
  }
}

export function formatNextStepUiPreviewPolicy(policy) {
  const p = validateNextStepUiPreviewPolicy(policy);
  return [
    'CANONICAL CROSS-PROJECT UI GOVERNANCE (GPT classification only; not execution authorization)',
    'Policy: ' + p.id + ' v' + p.version + ' ACTIVE',
    'GitHub source: ' + REPO + '/' + PATH + '@' + p.mainSha,
    'Policy SHA-256: ' + p.contentSha256,
    p.instruction,
    'Do not treat the policy as Owner PASS, task authorization or permission to mutate any production system.'
  ].join('\n');
}
