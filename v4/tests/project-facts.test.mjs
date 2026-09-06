import test from 'node:test';
import assert from 'node:assert/strict';
import { extractRoadmapOutline, extractRoadmapReferences, readAllGitHubProjectFacts, readGitHubProjectFacts, summarizeCheckRuns } from '../lib/project-facts.mjs';

const sha = 'a'.repeat(40);
const roadmap = '# Demo Roadmap\n\nCurrent Work Package: `WP-42`\nCurrent Task: **Task 7**\n\n## Phase A\nBuild the first phase.\n\n### Detail A1\n- evidence only\n';
const project = { id: 'demo', name: 'Demo', repository: 'owner/repo', roadmapPath: 'docs/roadmap.md' };
function fakeClient(overrides = {}) {
  const responses = {
    'repos/owner/repo': { full_name: 'owner/repo', default_branch: 'main', archived: false, visibility: 'private' },
    'repos/owner/repo/commits/main': { sha },
    [`repos/owner/repo/pulls?state=open&per_page=100`]: [{ number: 9, title: 'Demo PR', draft: true, state: 'open', head: { sha: 'b'.repeat(40) }, base: { ref: 'main' }, html_url: 'https://github.test/pr/9', updated_at: '2026-09-06T00:00:00Z' }],
    [`repos/owner/repo/commits/${sha}/check-runs?per_page=100`]: { check_runs: [{ status: 'completed', conclusion: 'success' }, { status: 'in_progress', conclusion: null }] },
    [`repos/owner/repo/contents/docs/roadmap.md?ref=${sha}`]: { type: 'file', encoding: 'base64', content: Buffer.from(roadmap).toString('base64'), sha: 'blob123' },
    ...overrides
  };
  return { api: async (path) => {
    if (!(path in responses)) throw new Error(`missing fixture ${path}`);
    const value = responses[path];
    if (value instanceof Error) throw value;
    return value;
  } };
}

test('roadmap references are exact labels only', () => {
  assert.deepEqual(extractRoadmapReferences(roadmap), { title: 'Demo Roadmap', currentWorkPackage: 'WP-42', currentTask: 'Task 7' });
  assert.equal(extractRoadmapReferences('# x\nNext Work Package: WP-99').currentWorkPackage, null);
});



test('roadmap outline projects exact GitHub markdown headings without status inference', () => {
  const outline = extractRoadmapOutline(roadmap);
  assert.deepEqual(outline.map(({ title, level, line }) => ({ title, level, line })), [
    { title: 'Phase A', level: 2, line: 6 },
    { title: 'Detail A1', level: 3, line: 9 }
  ]);
  assert.deepEqual(outline[0].excerpt, ['Build the first phase.']);
});

test('GitHub facts are bound to exact default-branch head and provenance', async () => {
  const facts = await readGitHubProjectFacts(project, { client: fakeClient(), now: () => new Date('2026-09-06T01:02:03Z') });
  assert.equal(facts.repository, 'owner/repo');
  assert.equal(facts.defaultBranch, 'main');
  assert.equal(facts.mainSha, sha);
  assert.equal(facts.roadmap.currentWorkPackage, 'WP-42');
  assert.equal(facts.roadmap.currentTask, 'Task 7');
  assert.equal(facts.roadmap.currentPointers.workPackage.line, 3);
  assert.equal(facts.roadmap.currentPointers.task.line, 4);
  assert.equal(facts.roadmap.outline[0].title, 'Phase A');
  assert.equal(facts.openPullRequests[0].number, 9);
  assert.equal(facts.ci.total, 2);
  assert.deepEqual(facts.ci.byStatus, { completed: 1, in_progress: 1 });
  assert.equal(facts.provenance.source, 'github');
  assert.equal(facts.provenance.ref, sha);
});

test('CI projection preserves GitHub status/conclusion counts without semantic gate inference', () => {
  assert.deepEqual(summarizeCheckRuns({ check_runs: [{ status: 'completed', conclusion: 'failure' }] }), { total: 1, byStatus: { completed: 1 }, byConclusion: { failure: 1 } });
});

test('all-project refresh fails individual projects visibly instead of fabricating facts', async () => {
  const registry = { projects: [project, { id: 'bad', name: 'Bad', repository: 'owner/bad' }] };
  const client = fakeClient({ 'repos/owner/bad': new Error('404') });
  const facts = await readAllGitHubProjectFacts(registry, { client, now: () => new Date('2026-09-06T01:02:03Z') });
  assert.equal(facts[0].available, true);
  assert.equal(facts[1].available, false);
  assert.equal(facts[1].error.code, 'GITHUB_FACTS_UNAVAILABLE');
});
