import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createV4Server } from '../server.mjs';

const sha = 'c'.repeat(40);
const registry = { schema: 'aicc.v4.project-registry.v1', projects: [{ id: 'demo', name: 'Demo', repository: 'owner/repo' }] };
const client = { api: async (path) => {
  if (path === 'repos/owner/repo') return { full_name: 'owner/repo', default_branch: 'main', archived: false, visibility: 'private' };
  if (path === 'repos/owner/repo/commits/HEAD') return { sha };
  if (path === 'repos/owner/repo/pulls?state=open&per_page=100') return [];
  if (path === `repos/owner/repo/commits/${sha}/check-runs?per_page=100`) return { check_runs: [] };
  throw new Error(`unexpected path ${path}`);
} };

async function withServer(run) {
  const dir = await mkdtemp(join(tmpdir(), 'aicc-v4-'));
  const registryPath = join(dir, 'projects.json');
  const machineRegistryPath = join(dir, 'machines.json');
  const runtimeObservationPath = join(dir, 'runtime.json');
  await writeFile(registryPath, JSON.stringify(registry));
  await writeFile(machineRegistryPath, JSON.stringify({ schema:'aicc.v4.machine-registry.v1', machines:[{ id:'cn-mac', name:'CN Mac', deviceId:'11111111-1111-4111-8111-111111111111', role:'Primary Development' }] }));
  await writeFile(runtimeObservationPath, JSON.stringify({ schema:'aicc.v4.runtime-observation.v1', source:'remote-desktop-commander', observedAt:'2026-09-06T01:59:30Z', devices:[{ deviceId:'11111111-1111-4111-8111-111111111111', status:'online', projectIds:['demo'] }] }));
  const server = await createV4Server({ registryPath, machineRegistryPath, runtimeObservationPath, client, now: () => new Date('2026-09-06T02:00:00Z') });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test('read-only API exposes project facts and rejects mutations', async () => {
  await withServer(async (base) => {
    const page = await fetch(`${base}/`).then((r) => r.text());
    assert.match(page, /id=\"switcherButton\"/);
    const asset = await fetch(`${base}/app.js`).then((r) => r.text());
    assert.match(asset, /All Projects/);
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
