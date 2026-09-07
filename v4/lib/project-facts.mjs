import { createHash } from 'node:crypto';

function encodeRepositoryPath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

function cleanInlineValue(value) {
  return value.replace(/^\s*[`*_]+|[`*_]+\s*$/g, '').trim();
}

function cleanHeading(value) {
  return value.replace(/\s+#+\s*$/, '').replace(/[`*_]/g, '').trim();
}



const OWNER_PR_LABEL_TYPES = Object.freeze({
  'owner-attention': 'OWNER_ACTION',
  'owner-uat': 'HUMAN_UAT',
  'owner-merge': 'MERGE_APPROVAL',
  'owner-deploy': 'DEPLOY_APPROVAL',
  'owner-production': 'PRODUCTION_GATE',
  'owner-decision': 'OWNER_DECISION'
});

function ownerAttentionType(text) {
  const value = String(text ?? '');
  if (/\b(?:human\s+)?uat\b/i.test(value)) return 'HUMAN_UAT';
  if (/\bmerge\b/i.test(value)) return 'MERGE_APPROVAL';
  if (/\bdeploy(?:ment)?\b/i.test(value)) return 'DEPLOY_APPROVAL';
  if (/\bproduction\b/i.test(value)) return 'PRODUCTION_GATE';
  if (/\bdecision\b/i.test(value)) return 'OWNER_DECISION';
  return 'OWNER_ACTION';
}

function isClosedOwnerValue(value) {
  return /^(?:none|clear|pass|passed|closed|done|complete|completed|approved|accepted|merged|n\/a|na)$/i.test(cleanInlineValue(String(value ?? '')));
}

export function extractOwnerAttention(markdown) {
  const lines = String(markdown ?? '').split(/\r?\n/);
  const items = [];
  let sectionLevel = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const heading = line.match(/^(#{2,6})\s+(.+?)\s*$/);
    if (heading) {
      const title = cleanHeading(heading[2]);
      const level = heading[1].length;
      if (/^Owner (?:Attention|Gates?)$/i.test(title)) sectionLevel = level;
      else if (sectionLevel && level <= sectionLevel) sectionLevel = null;
      continue;
    }
    const direct = line.match(/^\s*(?:[-*>]\s*)?(?:\*\*)?(Owner Attention|Owner Gate)(?:\*\*)?\s*[:：]\s*(.+?)\s*$/i);
    if (direct) {
      const title = cleanInlineValue(direct[2]);
      if (!title || isClosedOwnerValue(title)) continue;
      items.push(Object.freeze({ id: `roadmap-line-${index + 1}`, source: 'roadmap', type: ownerAttentionType(title), status: 'REQUIRED', title, line: index + 1 }));
      continue;
    }
    if (sectionLevel) {
      const unchecked = line.match(/^\s*[-*+]\s+\[ \]\s+(.+?)\s*$/);
      if (!unchecked) continue;
      const title = cleanInlineValue(unchecked[1]);
      if (!title || isClosedOwnerValue(title)) continue;
      items.push(Object.freeze({ id: `roadmap-line-${index + 1}`, source: 'roadmap', type: ownerAttentionType(title), status: 'REQUIRED', title, line: index + 1 }));
    }
  }
  return Object.freeze(items);
}

function pullRequestOwnerAttention(pr) {
  const labels = (Array.isArray(pr.labels) ? pr.labels : []).map((label) => typeof label === 'string' ? label : label?.name).filter(Boolean);
  const explicit = labels.filter((label) => OWNER_PR_LABEL_TYPES[label]);
  if (!explicit.length) return null;
  const specific = explicit.find((label) => label !== 'owner-attention') ?? explicit[0];
  return Object.freeze({
    id: `pr-${pr.number}`,
    source: 'pull-request',
    type: OWNER_PR_LABEL_TYPES[specific],
    status: 'REQUIRED',
    title: `PR #${pr.number} · ${pr.title}`,
    prNumber: pr.number,
    url: pr.html_url ?? null,
    labels: Object.freeze(explicit)
  });
}

function progressFromLines(lines, baseLine = 1) {
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^\s*(?:[-*>]\s*)?(?:\*\*)?Progress(?:\*\*)?\s*[:：]\s*`?([0-9]{1,3}(?:\.[0-9]+)?)%`?\s*$/i);
    if (!match) continue;
    const percentage = Number(match[1]);
    if (percentage >= 0 && percentage <= 100) return Object.freeze({ available: true, percentage, basis: 'explicit-percent', completed: null, total: null, line: baseLine + index });
  }
  let completed = 0;
  let total = 0;
  for (const line of lines) {
    const match = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+/);
    if (!match) continue;
    total += 1;
    if (match[1].toLowerCase() === 'x') completed += 1;
  }
  if (total) return Object.freeze({ available: true, percentage: Math.round((completed / total) * 1000) / 10, basis: 'markdown-checklist', completed, total, line: null });
  return Object.freeze({ available: false, percentage: null, basis: null, completed: null, total: null, line: null });
}

export function extractRoadmapProgress(markdown) {
  return progressFromLines(String(markdown ?? '').split(/\r?\n/), 1);
}

function pointerWithLine(lines, labels) {
  for (let index = 0; index < lines.length; index += 1) {
    for (const label of labels) {
      const match = lines[index].match(new RegExp(`^\\s*(?:[-*>]\\s*)?(?:\\*\\*)?${label}(?:\\*\\*)?\\s*[:：]\\s*(.+?)\\s*$`, 'i'));
      if (match) return Object.freeze({ value: cleanInlineValue(match[1]), line: index + 1 });
    }
  }
  return null;
}

export function extractRoadmapReferences(markdown) {
  const lines = String(markdown ?? '').split(/\r?\n/);
  const firstHeading = lines.find((line) => /^#\s+\S/.test(line));
  return Object.freeze({
    title: firstHeading ? cleanHeading(firstHeading.replace(/^#\s+/, '')) : null,
    currentWorkPackage: pointerWithLine(lines, ['Current Work Package', 'Current WP'])?.value ?? null,
    currentTask: pointerWithLine(lines, ['Current Task'])?.value ?? null
  });
}

export function extractRoadmapOutline(markdown) {
  const lines = String(markdown ?? '').split(/\r?\n/);
  const headings = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{2,4})\s+(.+?)\s*$/);
    if (match) headings.push({ index, level: match[1].length, title: cleanHeading(match[2]) });
  }
  return Object.freeze(headings.map((heading, position) => {
    let end = lines.length;
    for (let next = position + 1; next < headings.length; next += 1) {
      if (headings[next].level <= heading.level) { end = headings[next].index; break; }
    }
    const excerpt = [];
    for (let cursor = heading.index + 1; cursor < end && excerpt.length < 2; cursor += 1) {
      const line = lines[cursor].trim();
      if (/^#{1,6}\s+/.test(line)) break;
      if (!line || /^Current (?:Work Package|WP|Task)\s*[:：]/i.test(line)) continue;
      excerpt.push(line.replace(/^[-*>]\s*/, '').slice(0, 220));
    }
    return Object.freeze({
      id: `roadmap-line-${heading.index + 1}`,
      kind: 'roadmap-heading',
      title: heading.title,
      level: heading.level,
      line: heading.index + 1,
      excerpt: Object.freeze(excerpt),
      progress: progressFromLines(lines.slice(heading.index + 1, end), heading.index + 2)
    });
  }));
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
  const lines = text.split(/\r?\n/);
  const wp = pointerWithLine(lines, ['Current Work Package', 'Current WP']);
  const task = pointerWithLine(lines, ['Current Task']);
  return Object.freeze({
    path: project.roadmapPath,
    blobSha: file.sha ?? null,
    contentSha256: createHash('sha256').update(text).digest('hex'),
    ...refs,
    progress: extractRoadmapProgress(text),
    ownerAttention: Object.freeze(extractOwnerAttention(text).map((item) => Object.freeze({ ...item, path: project.roadmapPath }))),
    currentPointers: Object.freeze({
      workPackage: wp ? Object.freeze({ value: wp.value, line: wp.line }) : null,
      task: task ? Object.freeze({ value: task.value, line: task.line }) : null
    }),
    outline: extractRoadmapOutline(text)
  });
}

async function readRepositoryHead(project, client) {
  const [repo, commit] = await Promise.all([
    client.api(`repos/${project.repository}`),
    client.api(`repos/${project.repository}/commits/HEAD`)
  ]);
  const repository = repo?.full_name;
  const defaultBranch = repo?.default_branch;
  const mainSha = commit?.sha;
  if (repository !== project.repository || typeof defaultBranch !== 'string' || !defaultBranch) throw new Error('GitHub repository identity/default branch is unavailable');
  if (typeof mainSha !== 'string' || !/^[0-9a-f]{40}$/i.test(mainSha)) throw new Error('GitHub default branch head SHA is unavailable');
  return Object.freeze({ repo, repository, defaultBranch, mainSha });
}

export async function readGitHubProjectHead(project, { client, now = () => new Date() }) {
  const head = await readRepositoryHead(project, client);
  return Object.freeze({ schema: 'aicc.v4.github-project-head.v1', projectId: project.id, repository: head.repository, defaultBranch: head.defaultBranch, mainSha: head.mainSha, checkedAt: now().toISOString() });
}

export function compareProjectionFreshness(project, head, expectedRef, expectedRepository = null) {
  if (expectedRepository && expectedRepository !== project.repository) return Object.freeze({ status: 'DRIFT', reason: 'REPOSITORY_MISMATCH' });
  if (head.repository !== project.repository) return Object.freeze({ status: 'DRIFT', reason: 'GITHUB_REPOSITORY_MISMATCH' });
  if (expectedRef !== head.mainSha) return Object.freeze({ status: 'STALE', reason: 'DEFAULT_BRANCH_ADVANCED' });
  return Object.freeze({ status: 'FRESH', reason: 'EXACT_HEAD_MATCH' });
}

export async function readGitHubProjectFacts(project, { client, now = () => new Date() }) {
  const [head, pulls] = await Promise.all([
    readRepositoryHead(project, client),
    client.api(`repos/${project.repository}/pulls?state=open&per_page=100`)
  ]);
  const { repo, repository, defaultBranch, mainSha } = head;

  const [checks, roadmap] = await Promise.all([
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
    updatedAt: pr.updated_at ?? null,
    labels: Object.freeze((Array.isArray(pr.labels) ? pr.labels : []).map((label) => typeof label === 'string' ? label : label?.name).filter(Boolean))
  }));

  const ownerAttention = Object.freeze([
    ...(roadmap?.ownerAttention ?? []),
    ...(Array.isArray(pulls) ? pulls : []).map(pullRequestOwnerAttention).filter(Boolean)
  ]);

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
    ownerAttention,
    ci: summarizeCheckRuns(checks),
    provenance: Object.freeze({ source: 'github', repository, ref: mainSha, refreshedAt: now().toISOString() })
  });
}

function requestScopedClient(client) {
  const pending = new Map();
  return Object.freeze({
    api(apiPath) {
      if (!pending.has(apiPath)) pending.set(apiPath, Promise.resolve().then(() => client.api(apiPath)));
      return pending.get(apiPath);
    }
  });
}

export async function readAllGitHubProjectFacts(registry, { client, now = () => new Date() }) {
  const options = { client: requestScopedClient(client), now };
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
