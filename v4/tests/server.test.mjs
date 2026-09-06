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
  if (path === 'repos/owner/repo/commits/main') return { sha };
  if (path === 'repos/owner/repo/pulls?state=open&per_page=100') return [];
  if (path === `repos/owner/repo/commits/${sha}/check-runs?per_page=100`) return { check_runs: [] };
  throw new Error(`unexpected path ${path}`);
} };

async function withServer(run) {
  const dir = await mkdtemp(join(tmpdir(), 'aicc-v4-'));
  const registryPath = join(dir, 'projects.json');
  await writeFile(registryPath, JSON.stringify(registry));
  const server = await createV4Server({ registryPath, client, now: () => new Date('2026-09-06T02:00:00Z') });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test('read-only API exposes project facts and rejects mutations', async () => {
  await withServer(async (base) => {
    const health = await fetch(`${base}/api/health`).then((r) => r.json());
    assert.equal(health.projectCount, 1);
    const facts = await fetch(`${base}/api/projects/demo`).then((r) => r.json());
    assert.equal(facts.mainSha, sha);
    assert.equal(facts.provenance.source, 'github');
    const mutation = await fetch(`${base}/api/projects/demo`, { method: 'POST' });
    assert.equal(mutation.status, 405);
    assert.equal((await mutation.json()).error, 'READ_ONLY_API');
  });
});
