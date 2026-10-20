import { createHash } from 'node:crypto';

export const FAST_ITERATION_POLICY_REPOSITORY = 'beyourlovercom/aicontrolcenter';
export const FAST_ITERATION_POLICY_PATH = 'docs/00_Governance/AICC-GLOBAL-FAST-ITERATION-V1.md';
export const FAST_ITERATION_POLICY_ID = 'AICC-GLOBAL-FAST-ITERATION-V1';
const SHA = /^[0-9a-f]{40}$/i;

function unavailable(detail) {
  const error = new Error('Canonical GitHub fast iteration policy unavailable or invalid: ' + detail);
  error.code = 'GLOBAL_FAST_ITERATION_POLICY_UNAVAILABLE';
  return error;
}

export function validateGlobalFastIterationPolicy(policy, expectedMainSha) {
  if (policy?.id !== FAST_ITERATION_POLICY_ID || policy?.version !== 1 || policy?.status !== 'ACTIVE') throw unavailable('policy identity');
  if (!SHA.test(policy.mainSha || '') || !SHA.test(policy.blobSha || '') ||
      !/^[0-9a-f]{64}$/i.test(policy.contentSha256 || '')) throw unavailable('provenance');
  if (expectedMainSha && policy.mainSha !== expectedMainSha) throw unavailable('cross-policy main SHA drift');
  if (policy.canonicalRepository !== FAST_ITERATION_POLICY_REPOSITORY ||
      policy.canonicalPath !== FAST_ITERATION_POLICY_PATH) throw unavailable('canonical source');
  if (typeof policy.instruction !== 'string' || !policy.instruction.trim() || policy.instruction.length > 4000) throw unavailable('instruction');
  for (const required of ['GPT', 'Owner Dev UAT', 'Global UI Preview First', 'Owner exact-head merge', 'WWW/Production']) {
    if (!policy.instruction.includes(required)) throw unavailable('missing ' + required);
  }
  return Object.freeze({ ...policy });
}

export function parseGlobalFastIterationPolicy(markdown, { mainSha, blobSha } = {}) {
  if (typeof markdown !== 'string' || Buffer.byteLength(markdown, 'utf8') > 20000) throw unavailable('policy size');
  if (!SHA.test(mainSha || '') || !SHA.test(blobSha || '')) throw unavailable('GitHub commit/blob');
  for (const line of [
    'Policy-ID: `AICC-GLOBAL-FAST-ITERATION-V1`',
    'Policy-Version: `1`',
    'Status: `ACTIVE`',
    'Effective-After: `OWNER_APPROVED_MERGE`'
  ]) {
    if (!markdown.split(/\r?\n/).includes(line)) throw unavailable('policy metadata');
  }
  const sections = markdown.split(/^## GPT Context Instruction[ \t]*\r?\n/m);
  const instruction = sections.length === 2 ? sections[1].split(/\r?\n## /, 1)[0].trim() : '';
  return validateGlobalFastIterationPolicy({
    id: FAST_ITERATION_POLICY_ID,
    version: 1,
    status: 'ACTIVE',
    canonicalRepository: FAST_ITERATION_POLICY_REPOSITORY,
    canonicalPath: FAST_ITERATION_POLICY_PATH,
    mainSha,
    blobSha,
    contentSha256: createHash('sha256').update(markdown).digest('hex'),
    instruction
  });
}

/**
 * Reuse the exact canonical main SHA pinned by the UI Preview policy.
 * No second HEAD lookup: a mid-request GitHub main movement cannot mix rules.
 */
export async function readGlobalFastIterationPolicy(client, { mainSha } = {}) {
  if (!SHA.test(mainSha || '')) throw unavailable('missing pinned main SHA');
  try {
    const file = await client.api('repos/' + FAST_ITERATION_POLICY_REPOSITORY +
      '/contents/' + FAST_ITERATION_POLICY_PATH + '?ref=' + mainSha);
    if (file?.type !== 'file' || file.encoding !== 'base64' || !SHA.test(file.sha || '') ||
        typeof file.content !== 'string' || file.content.length > 30000 ||
        !/^[A-Za-z0-9+/=\s]+$/.test(file.content)) throw unavailable('file response');
    return parseGlobalFastIterationPolicy(
      Buffer.from(file.content.replace(/\s/g, ''), 'base64').toString('utf8'),
      { mainSha, blobSha: file.sha }
    );
  } catch (error) {
    if (error?.code === 'GLOBAL_FAST_ITERATION_POLICY_UNAVAILABLE') throw error;
    throw unavailable(error?.code || 'GitHub read failed');
  }
}
