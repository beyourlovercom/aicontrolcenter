import { createHash } from 'node:crypto';

function encodeRepositoryPath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

function cleanInlineValue(value) {
  return value.replace(/^\s*[`*_]+|[`*_]+\s*$/g, '').trim();
}

export function extractRoadmapReferences(markdown) {
  const lines = String(markdown ?? '').split(/\r?\n/);
  const firstHeading = lines.find((line) => /^#\s+\S/.test(line));
  const findValue = (labels) => {
    for (const line of lines) {
      for (const label of labels) {
        const match = line.match(new RegExp(`^\\s*(?:[-*>]\\s*)?(?:\\*\\*)?${label}(?:\\*\\*)?\\s*[:：]\\s*(.+?)\\s*$`, 'i'));
        if (match) return cleanInlineValue(match[1]);
      }
    }
    return null;
  };
  return Object.freeze({
    title: firstHeading ? firstHeading.replace(/^#\s+/, '').trim() : null,
    currentWorkPackage: findValue(['Current Work Package', 'Current WP']),
    currentTask: findValue(['Current Task'])
  });
}

export function summarizeCheckRuns(input) {
  const runs = Array.isArray(input?.check_runs) ? input.check_runs : [];
  const byStatus = {};
  const byConclusion = {};
  for (const run of runs) {
    const status = run?.status ?? 'unknown';
    const conclusion = run?.conclusion ?? 'none';
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    byConclusion[conclusion] = (byConclusion[conclusion] ?? 0) + 1;
  }
  return Object.freeze({ total: runs.length, byStatus: Object.freeze(byStatus), byConclusion: Object.freeze(byConclusion) });
}

async function readRoadmap(project, mainSha, client) {
  if (!project.roadmapPath) return null;
  const apiPath = `repos/${project.repository}/contents/${encodeRepositoryPath(project.roadmapPath)}?ref=${encodeURIComponent(mainSha)}`;
  const file = await client.api(apiPath);
  if (!file || file.type !== 'file' || file.encoding !== 'base64' || typeof file.content !== 'string') {
    throw new Error('roadmap locator did not resolve to a base64 GitHub file');
  }
  const text = Buffer.from(file.content.replace(/\n/g, ''), 'base64').toString('utf8');
  const refs = extractRoadmapReferences(text);
  return Object.freeze({
    path: project.roadmapPath,
    blobSha: file.sha ?? null,
    contentSha256: createHash('sha256').update(text).digest('hex'),
    ...refs
  });
}

export async function readGitHubProjectFacts(project, { client, now = () => new Date() }) {
  const repo = await client.api(`repos/${project.repository}`);
  const repository = repo?.full_name;
  const defaultBranch = repo?.default_branch;
  if (repository !== project.repository || typeof defaultBranch !== 'string' || !defaultBranch) {
    throw new Error('GitHub repository identity/default branch is unavailable');
  }

  const commit = await client.api(`repos/${project.repository}/commits/${encodeURIComponent(defaultBranch)}`);
  const mainSha = commit?.sha;
  if (typeof mainSha !== 'string' || !/^[0-9a-f]{40}$/i.test(mainSha)) {
    throw new Error('GitHub default branch head SHA is unavailable');
  }

  const [pulls, checks, roadmap] = await Promise.all([
    client.api(`repos/${project.repository}/pulls?state=open&per_page=100`),
    client.api(`repos/${project.repository}/commits/${mainSha}/check-runs?per_page=100`),
    readRoadmap(project, mainSha, client)
  ]);

  const openPullRequests = (Array.isArray(pulls) ? pulls : []).map((pr) => Object.freeze({
    number: pr.number,
    title: pr.title,
    draft: Boolean(pr.draft),
    state: pr.state,
    headSha: pr.head?.sha ?? null,
    baseRef: pr.base?.ref ?? null,
    url: pr.html_url ?? null,
    updatedAt: pr.updated_at ?? null
  }));

  return Object.freeze({
    schema: 'aicc.v4.github-project-facts.v1',
    available: true,
    projectId: project.id,
    name: project.name,
    repository,
    defaultBranch,
    mainSha,
    repositoryState: Object.freeze({ archived: Boolean(repo.archived), visibility: repo.visibility ?? null }),
    roadmap,
    openPullRequests: Object.freeze(openPullRequests),
    ci: summarizeCheckRuns(checks),
    provenance: Object.freeze({
      source: 'github',
      repository,
      ref: mainSha,
      refreshedAt: now().toISOString()
    })
  });
}

export async function readAllGitHubProjectFacts(registry, { client, now = () => new Date() }) {
  const options = { client, now };
  return Promise.all(registry.projects.map(async (project) => {
    try {
      return await readGitHubProjectFacts(project, options);
    } catch (error) {
      return Object.freeze({
        schema: 'aicc.v4.github-project-facts.v1',
        available: false,
        projectId: project.id,
        name: project.name,
        repository: project.repository,
        error: Object.freeze({ code: error.code ?? 'GITHUB_FACTS_UNAVAILABLE', message: error.message }),
        provenance: Object.freeze({ source: 'github', repository: project.repository, refreshedAt: options.now().toISOString() })
      });
    }
  }));
}
