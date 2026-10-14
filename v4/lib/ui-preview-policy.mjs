import { createHash } from 'node:crypto';

export const UI_PREVIEW_POLICY_REPOSITORY = 'beyourlovercom/aicontrolcenter';
export const UI_PREVIEW_POLICY_PATH = 'docs/00_Governance/AICC-GLOBAL-UI-PREVIEW-FIRST-V1.md';
export const UI_PREVIEW_POLICY_ID = 'AICC-GLOBAL-UI-PREVIEW-FIRST-V1';

function unavailable(detail) {
  const error = new Error('Canonical GitHub UI preview policy unavailable or invalid: ' + detail);
  error.code = 'GLOBAL_UI_PREVIEW_POLICY_UNAVAILABLE';
  return error;
}

export function parseGlobalUiPreviewPolicy(markdown, { mainSha, blobSha } = {}) {
  if (typeof markdown !== 'string' || Buffer.byteLength(markdown, 'utf8') > 16000) throw unavailable('policy size');
  if (typeof mainSha !== 'string' || !/^[0-9a-f]{40}$/i.test(mainSha)) throw unavailable('unverified GitHub main SHA');
  if (typeof blobSha !== 'string' || !/^[0-9a-f]{40}$/i.test(blobSha)) throw unavailable('unverified GitHub file blob SHA');
  if (!/^Policy-ID: \x60AICC-GLOBAL-UI-PREVIEW-FIRST-V1\x60$/m.test(markdown)) throw unavailable('policy identity');
  if (!/^Policy-Version: \x601\x60$/m.test(markdown)) throw unavailable('policy version');
  if (!/^Status: \x60ACTIVE\x60$/m.test(markdown)) throw unavailable('policy status');
  const block = markdown.match(/^## GPT Context Instruction[ \t]*\r?\n([\s\S]*?)(?:\r?\n## |\s*$)/m);
  const instruction = block?.[1]?.trim();
  if (!instruction || instruction.length > 4000) throw unavailable('missing or oversized GPT instruction');
  for (const required of ['AppBlock', 'OWNER_VISUAL_PASS', 'Production', 'GPT']) {
    if (!instruction.includes(required)) throw unavailable('incomplete GPT instruction');
  }
  return Object.freeze({
    id: UI_PREVIEW_POLICY_ID,
    version: 1,
    status: 'ACTIVE',
    canonicalRepository: UI_PREVIEW_POLICY_REPOSITORY,
    canonicalPath: UI_PREVIEW_POLICY_PATH,
    mainSha,
    blobSha,
    contentSha256: createHash('sha256').update(markdown).digest('hex'),
    instruction
  });
}

/**
 * Only the canonical governance GitHub repository supplies this policy.
 * The exact main SHA is checked first and the Markdown is read at that ref.
 * Fail closed so a copied GPT Context cannot silently lose the UI preview gate.
 */
export async function readGlobalUiPreviewPolicy(client) {
  try {
    const commit = await client.api('repos/' + UI_PREVIEW_POLICY_REPOSITORY + '/commits/HEAD');
    const sha = commit?.sha;
    if (typeof sha !== 'string' || !/^[0-9a-f]{40}$/i.test(sha)) throw unavailable('GitHub HEAD');
    const path = 'repos/' + UI_PREVIEW_POLICY_REPOSITORY + '/contents/' + UI_PREVIEW_POLICY_PATH + '?ref=' + sha;
    const file = await client.api(path);
    if (file?.type !== 'file' || file?.encoding !== 'base64' || typeof file.content !== 'string') throw unavailable('file response');
    if (file.content.length > 25000 || !/^[a-zA-Z0-9+/\s=]+$/.test(file.content)) throw unavailable('file encoding');
    return parseGlobalUiPreviewPolicy(Buffer.from(file.content.replace(/\s/g, ''), 'base64').toString('utf8'), {
      mainSha: sha,
      blobSha: file.sha
    });
  } catch (error) {
    if (error?.code === 'GLOBAL_UI_PREVIEW_POLICY_UNAVAILABLE') throw error;
    throw unavailable(error?.code || 'GitHub read failed');
  }
}
