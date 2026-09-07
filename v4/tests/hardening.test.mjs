import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGhApiClient } from '../lib/github-client.mjs';
import { readAllGitHubProjectFacts, readGitHubProjectFacts } from '../lib/project-facts.mjs';
import { createV4Server } from '../server.mjs';

const sha = 'a'.repeat(40);

function hangingChild() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = (signal) => {
    child.killedSignal = signal;
    queueMicrotask(() => child.emit('close', 143));
    return true;
  };
  return child;
}

test('GitHub CLI reads fail closed on timeout instead of hanging the dashboard', async () => {
  const child = hangingChild();
  const client = createGhApiClient({ timeoutMs: 15, spawnFn: () => child });
  await assert.rejects(client.api('repos/owner/repo'), (error) => {
    assert.equal(error.code, 'GITHUB_API_TIMEOUT');
    return true;
  });
  assert.equal(child.killedSignal, 'SIGTERM');
});


test('project fact seed reads repository metadata, default HEAD and open PRs concurrently', async () => {
  const initial = new Set(['repos/owner/repo','repos/owner/repo/commits/HEAD','repos/owner/repo/pulls?state=open&per_page=100']);
  let activeInitial = 0;
  let maxInitial = 0;
  const client = { api: async (path) => {
    if (initial.has(path)) {
      activeInitial += 1;
      maxInitial = Math.max(maxInitial, activeInitial);
      await new Promise((resolve) => setTimeout(resolve, 20));
      activeInitial -= 1;
      if (path === 'repos/owner/repo') return { full_name:'owner/repo', default_branch:'trunk', archived:false, visibility:'private' };
      if (path === 'repos/owner/repo/commits/HEAD') return { sha };
      return [];
    }
    if (path === `repos/owner/repo/commits/${sha}/check-runs?per_page=100`) return { check_runs:[] };
    throw new Error(`unexpected ${path}`);
  } };
  const facts = await readGitHubProjectFacts({ id:'demo', name:'Demo', repository:'owner/repo' }, { client });
  assert.equal(maxInitial, 3);
  assert.equal(facts.defaultBranch, 'trunk');
  assert.equal(facts.mainSha, sha);
});
test('same-repository project views share identical GitHub reads within one refresh', async () => {
  const calls = new Map();
  const client = { api: async (path) => {
    calls.set(path, (calls.get(path) || 0) + 1);
    if (path === 'repos/owner/shared') return { full_name:'owner/shared', default_branch:'main', archived:false, visibility:'private' };
    if (path === 'repos/owner/shared/commits/HEAD') return { sha };
    if (path === 'repos/owner/shared/pulls?state=open&per_page=100') return [];
    if (path === `repos/owner/shared/commits/${sha}/check-runs?per_page=100`) return { check_runs:[] };
    throw new Error(`unexpected ${path}`);
  } };
  const registry = { projects:[
    { id:'view-a', name:'View A', repository:'owner/shared' },
    { id:'view-b', name:'View B', repository:'owner/shared' }
  ] };
  const facts = await readAllGitHubProjectFacts(registry, { client, now:() => new Date('2026-09-07T00:00:00Z') });
  assert.deepEqual(facts.map((item) => item.projectId), ['view-a','view-b']);
  assert.ok(facts.every((item) => item.available));
  assert.equal([...calls.values()].reduce((a,b) => a+b, 0), 4);
  assert.ok([...calls.values()].every((count) => count === 1));
});

test('All Projects bounds shared GitHub read concurrency without losing request de-duplication', async () => {
  let active = 0; let peak = 0;
  const client = { api: async (path) => {
    active += 1; peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active -= 1;
    const repo = path.match(/^repos\/([^/]+\/[^/]+)$/)?.[1];
    if (repo) return { full_name:repo, default_branch:'main', archived:false, visibility:'private' };
    if (/\/commits\/HEAD$/.test(path)) return { sha };
    if (/\/pulls\?state=open/.test(path)) return [];
    if (/\/check-runs\?/.test(path)) return { check_runs:[] };
    throw new Error(`unexpected ${path}`);
  } };
  const registry = { projects:['a','b','c','d','e'].map((id) => ({ id, name:id, repository:`owner/${id}` })) };
  const facts = await readAllGitHubProjectFacts(registry, { client, now:() => new Date('2026-09-07T00:00:00Z') });
  assert.equal(facts.length, 5);
  assert.ok(facts.every((item) => item.available));
  assert.ok(peak <= 4, `peak GitHub concurrency ${peak} exceeded 4`);
});

test('concurrent All Projects requests coalesce one in-flight GitHub refresh', async () => {
  const calls = new Map();
  const client = { api: async (path) => {
    calls.set(path, (calls.get(path) || 0) + 1);
    await new Promise((resolve) => setTimeout(resolve, 15));
    if (path === 'repos/owner/repo') return { full_name:'owner/repo', default_branch:'main', archived:false, visibility:'private' };
    if (path === 'repos/owner/repo/commits/HEAD') return { sha };
    if (path === 'repos/owner/repo/pulls?state=open&per_page=100') return [];
    if (path === `repos/owner/repo/commits/${sha}/check-runs?per_page=100`) return { check_runs:[] };
    throw new Error(`unexpected ${path}`);
  } };
  const dir = await mkdtemp(join(tmpdir(), 'aicc-v48-'));
  const registryPath = join(dir, 'projects.json');
  const machineRegistryPath = join(dir, 'machines.json');
  await writeFile(registryPath, JSON.stringify({ schema:'aicc.v4.project-registry.v1', projects:[{ id:'demo', name:'Demo', repository:'owner/repo' }] }));
  await writeFile(machineRegistryPath, JSON.stringify({ schema:'aicc.v4.machine-registry.v1', machines:[{ id:'cn-mac', name:'CN Mac', deviceId:'11111111-1111-4111-8111-111111111111', role:'Primary Development' }] }));
  const server = await createV4Server({ registryPath, machineRegistryPath, runtimeObservationPath:join(dir,'missing.json'), client });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/projects`;
    const [a,b] = await Promise.all([fetch(base).then((r)=>r.json()), fetch(base).then((r)=>r.json())]);
    assert.equal(a.projects[0].mainSha, sha);
    assert.equal(b.projects[0].mainSha, sha);
    assert.equal([...calls.values()].reduce((x,y)=>x+y,0), 4);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test('All Projects bulk GraphQL uses one aggregate query and exact HEAD verification per unique repo', async () => {
  let graphqlCalls = 0;
  const apiCalls = [];
  const makeRepo = (nameWithOwner, roadmapText = null) => ({
    nameWithOwner, isArchived:false, visibility:'PRIVATE',
    defaultBranchRef:{ name:'main', target:{ oid:sha, statusCheckRollup:{ contexts:{ nodes:[{ __typename:'CheckRun', status:'COMPLETED', conclusion:'SUCCESS', name:'verify' }] } } } },
    pullRequests:{ nodes:[] },
    ...(roadmapText == null ? {} : { roadmap0:{ oid:'blob-sha', text:roadmapText } })
  });
  const client = {
    graphql: async (query) => {
      graphqlCalls += 1;
      assert.match(query, /repository\(owner:"owner", name:"one"\)/);
      assert.match(query, /repository\(owner:"owner", name:"shared"\)/);
      return { data:{
        repo0:makeRepo('owner/one', '# One\n\nCurrent Work Package: `WP-1`\n'),
        repo1:makeRepo('owner/shared', '# Shared\n\nCurrent Work Package: `WP-SHARED`\n')
      } };
    },
    api: async (path) => { apiCalls.push(path); return { sha }; }
  };
  const registry = { projects:[
    { id:'one', name:'One', repository:'owner/one', roadmapPath:'docs/one.md' },
    { id:'shared-a', name:'Shared A', repository:'owner/shared', roadmapPath:'docs/shared.md' },
    { id:'shared-b', name:'Shared B', repository:'owner/shared' }
  ] };
  const facts = await readAllGitHubProjectFacts(registry, { client, now:() => new Date('2026-09-07T00:00:00Z') });
  assert.equal(graphqlCalls, 1);
  assert.deepEqual(apiCalls.sort(), ['repos/owner/one/commits/HEAD','repos/owner/shared/commits/HEAD']);
  assert.deepEqual(facts.map((item) => item.projectId), ['one','shared-a','shared-b']);
  assert.ok(facts.every((item) => item.available && item.mainSha === sha));
  assert.equal(facts[1].roadmap.currentWorkPackage, 'WP-SHARED');
  assert.equal(facts[2].roadmap, null);
});
