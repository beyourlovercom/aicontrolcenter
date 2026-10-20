import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createV4Server } from '../server.mjs';

const sha = 'c'.repeat(40);
const canonicalPolicy = await readFile(new URL('../../docs/00_Governance/AICC-GLOBAL-UI-PREVIEW-FIRST-V1.md', import.meta.url), 'utf8');
const fastPolicy = await readFile(new URL('../../docs/00_Governance/AICC-GLOBAL-FAST-ITERATION-V1.md', import.meta.url), 'utf8');
const registry = { schema: 'aicc.v4.project-registry.v1', projects: [{ id: 'demo', name: 'Demo', repository: 'owner/repo' }] };
const client = { api: async (path) => {
  if (path === 'repos/beyourlovercom/aicontrolcenter/commits/HEAD') return { sha };
  if (path === `repos/beyourlovercom/aicontrolcenter/contents/docs/00_Governance/AICC-GLOBAL-UI-PREVIEW-FIRST-V1.md?ref=${sha}`) return { type:'file', encoding:'base64', content:Buffer.from(canonicalPolicy).toString('base64'), sha:'d'.repeat(40) };
  if (path === `repos/beyourlovercom/aicontrolcenter/contents/docs/00_Governance/AICC-GLOBAL-FAST-ITERATION-V1.md?ref=${sha}`) return { type:'file', encoding:'base64', content:Buffer.from(fastPolicy).toString('base64'), sha:'e'.repeat(40) };
  if (path === 'repos/owner/repo') return { full_name: 'owner/repo', default_branch: 'main', archived: false, visibility: 'private' };
  if (path === 'repos/owner/repo/commits/HEAD') return { sha };
  if (path === 'repos/owner/repo/pulls?state=open&per_page=100') return [];
  if (path === `repos/owner/repo/commits/${sha}/check-runs?per_page=100`) return { check_runs: [] };
  throw new Error(`unexpected path ${path}`);
} };

async function withServer(run, customClient = client) {
  const dir = await mkdtemp(join(tmpdir(), 'aicc-v4-'));
  const registryPath = join(dir, 'projects.json');
  const machineRegistryPath = join(dir, 'machines.json');
  const runtimeObservationPath = join(dir, 'runtime.json');
  await writeFile(registryPath, JSON.stringify(registry));
  await writeFile(machineRegistryPath, JSON.stringify({ schema:'aicc.v4.machine-registry.v1', machines:[{ id:'cn-mac', name:'CN Mac', deviceId:'11111111-1111-4111-8111-111111111111', role:'Primary Development' }] }));
  await writeFile(runtimeObservationPath, JSON.stringify({ schema:'aicc.v4.runtime-observation.v1', source:'remote-desktop-commander', observedAt:'2026-09-06T01:59:30Z', devices:[{ deviceId:'11111111-1111-4111-8111-111111111111', status:'online', projectIds:['demo'] }] }));
  const server = await createV4Server({ registryPath, machineRegistryPath, runtimeObservationPath, client:customClient, now: () => new Date('2026-09-06T02:00:00Z') });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test('read-only API exposes project facts and rejects mutations', async () => {
  await withServer(async (base) => {
    const page = await fetch(`${base}/`).then((r) => r.text());
    assert.match(page, /id=\"switcherButton\"/);
    const asset = await fetch(`${base}/app.js`).then((r) => r.text());
    assert.match(asset, /所有项目/);
    const health = await fetch(`${base}/api/health`).then((r) => r.json());
    assert.equal(health.projectCount, 1);
    assert.equal(health.machineCount, 1);
    const runtime = await fetch(`${base}/api/runtime`).then((r) => r.json());
    assert.equal(runtime.observationState, 'FRESH_OBSERVATION');
    assert.equal(runtime.machines[0].status, 'ONLINE');
    const facts = await fetch(`${base}/api/projects/demo`).then((r) => r.json());
    assert.equal(facts.mainSha, sha);
    assert.equal(facts.provenance.source, 'github');
    const context = await fetch(`${base}/api/projects/demo/context`).then((r) => r.json());
    assert.equal(context.schema, 'aicc.v4.gpt-context.v1');
    assert.equal(context.github.mainSha, sha);
    assert.equal(context.authority.sourceOfTruth, 'GitHub');
    assert.equal(context.uiPreviewPolicy.id, 'AICC-GLOBAL-UI-PREVIEW-FIRST-V1');
    assert.equal(context.uiPreviewPolicy.mainSha, sha);
    assert.equal(context.fastIterationPolicy.id, 'AICC-GLOBAL-FAST-ITERATION-V1');
    assert.equal(context.fastIterationPolicy.mainSha, sha);
    assert.match(context.copyText, /GLOBAL FAST ITERATION/);
    assert.match(context.copyText, /OWNER_VISUAL_PASS/);
    assert.match(context.copyText, /AppBlock/);
    assert.match(context.copyText, /Before action: reconcile current GitHub evidence/);
    const fresh = await fetch(`${base}/api/projects/demo/freshness?ref=${sha}&repository=owner%2Frepo`).then((r) => r.json());
    assert.equal(fresh.status, 'FRESH');
    const stale = await fetch(`${base}/api/projects/demo/freshness?ref=${'d'.repeat(40)}&repository=owner%2Frepo`).then((r) => r.json());
    assert.equal(stale.status, 'STALE');
    const drift = await fetch(`${base}/api/projects/demo/freshness?ref=${sha}&repository=owner%2Fother`).then((r) => r.json());
    assert.equal(drift.status, 'DRIFT');
    const mutation = await fetch(`${base}/api/projects/demo`, { method: 'POST' });
    assert.equal(mutation.status, 405);
    assert.equal((await mutation.json()).error, 'READ_ONLY_API');
  });
});

test('context API explicitly rejects a missing canonical GitHub policy instead of silently waiving preview', async () => {
  const brokenClient = { api: async (path) => {
    if (path === 'repos/beyourlovercom/aicontrolcenter/commits/HEAD') throw new Error('not available');
    return client.api(path);
  } };
  await withServer(async (base) => {
    const response = await fetch(base + '/api/projects/demo/context');
    assert.equal(response.status, 502);
    const payload = await response.json();
    assert.equal(payload.error, 'GLOBAL_UI_PREVIEW_POLICY_UNAVAILABLE');
    assert.equal(payload.copyText, undefined);
    // Unrelated GitHub project reads remain read-only and usable.
    const facts = await fetch(base + '/api/projects/demo').then(r => r.json());
    assert.equal(facts.mainSha, sha);
  }, brokenClient);
});

test('context API refuses missing pinned fast policy while other read APIs still work', async () => {
  const brokenClient = { api: async (path) => {
    if (path.includes('/AICC-GLOBAL-FAST-ITERATION-V1.md?ref=')) throw new Error('missing canonical fast rule');
    return client.api(path);
  } };
  await withServer(async (base) => {
    const response = await fetch(base + '/api/projects/demo/context');
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error, 'GLOBAL_FAST_ITERATION_POLICY_UNAVAILABLE');
    assert.equal((await fetch(base + '/api/projects/demo').then(r=>r.json())).mainSha, sha);
  }, brokenClient);
});
