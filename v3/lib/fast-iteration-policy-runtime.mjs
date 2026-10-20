import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';

const run = promisify(execFile);
const REPO = 'beyourlovercom/aicontrolcenter';
const PATH = 'docs/00_Governance/AICC-GLOBAL-FAST-ITERATION-V1.md';
const ID = 'AICC-GLOBAL-FAST-ITERATION-V1';
const shaPattern = /^[0-9a-f]{40}$/i;

function fail() {
  const error = new Error('Canonical AICC fast iteration policy unavailable, invalid or out of date');
  error.code = 'NEXT_STEP_GLOBAL_FAST_ITERATION_POLICY_UNAVAILABLE';
  throw error;
}

export function validateNextStepFastIterationPolicy(input, expectedMainSha) {
  if (input?.id !== ID || input?.status !== 'ACTIVE' || input?.version !== 1) fail();
  if (!shaPattern.test(input?.mainSha || '') || !shaPattern.test(input?.blobSha || '') ||
      !/^[0-9a-f]{64}$/i.test(input?.contentSha256 || '')) fail();
  if (expectedMainSha && input.mainSha !== expectedMainSha) fail();
  if (typeof input?.instruction !== 'string' || !input.instruction.trim() || input.instruction.length > 4000) fail();
  for (const required of ['GPT', 'Owner Dev UAT', 'Global UI Preview First', 'Owner exact-head merge', 'WWW/Production']) {
    if (!input.instruction.includes(required)) fail();
  }
  return Object.freeze({
    id: ID, status: 'ACTIVE', version: 1,
    mainSha: input.mainSha, blobSha: input.blobSha,
    contentSha256: input.contentSha256, instruction: input.instruction
  });
}

export function parseNextStepFastIterationPolicy(markdown, mainSha, blobSha) {
  if (typeof markdown !== 'string' || Buffer.byteLength(markdown, 'utf8') > 20000) fail();
  if (!shaPattern.test(mainSha || '') || !shaPattern.test(blobSha || '')) fail();
  const lines = markdown.split(/\r?\n/);
  for (const required of [
    'Policy-ID: `AICC-GLOBAL-FAST-ITERATION-V1`',
    'Policy-Version: `1`',
    'Status: `ACTIVE`',
    'Effective-After: `OWNER_APPROVED_MERGE`'
  ]) {
    if (!lines.includes(required)) fail();
  }
  const sections = markdown.split(/^## GPT Context Instruction[ \t]*\r?\n/m);
  if (sections.length !== 2) fail();
  const instruction = sections[1].split(/\r?\n## /, 1)[0].trim();
  return validateNextStepFastIterationPolicy({
    id: ID, version: 1, status: 'ACTIVE', mainSha, blobSha,
    contentSha256: createHash('sha256').update(markdown).digest('hex'), instruction
  });
}

async function ghApi(path) {
  const { stdout } = await run('gh', ['api', path], { timeout: 10000, maxBuffer: 65536 });
  return JSON.parse(stdout);
}

/** Pin to the verified UI-preview main SHA; never fetch HEAD a second time. */
export async function loadNextStepFastIterationPolicy({ api = ghApi, mainSha } = {}) {
  if (!shaPattern.test(mainSha || '')) fail();
  try {
    const file = await api('repos/' + REPO + '/contents/' + PATH + '?ref=' + mainSha);
    if (file?.type !== 'file' || file.encoding !== 'base64' || !shaPattern.test(file.sha || '') ||
        typeof file.content !== 'string' || file.content.length > 30000 ||
        !/^[A-Za-z0-9+/=\s]+$/.test(file.content)) fail();
    return parseNextStepFastIterationPolicy(
      Buffer.from(file.content.replace(/\s/g, ''), 'base64').toString('utf8'),
      mainSha, file.sha
    );
  } catch (error) {
    if (error?.code === 'NEXT_STEP_GLOBAL_FAST_ITERATION_POLICY_UNAVAILABLE') throw error;
    fail();
  }
}

export function formatNextStepFastIterationPolicy(policy, expectedMainSha) {
  const p = validateNextStepFastIterationPolicy(policy, expectedMainSha);
  return [
    'CANONICAL CROSS-PROJECT FAST ITERATION GOVERNANCE (GPT classification only; not execution authorization)',
    'Policy: ' + p.id + ' v' + p.version + ' ACTIVE',
    'GitHub source: ' + REPO + '/' + PATH + '@' + p.mainSha,
    'Policy SHA-256: ' + p.contentSha256,
    p.instruction,
    'Do not treat this workflow policy as Owner PASS, merge, deployment or production-write permission.'
  ].join('\n');
}
