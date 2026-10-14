import { UI_PREVIEW_POLICY_ID } from './ui-preview-policy.mjs';

function clean(value, fallback = '—') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function prSort(a, b) {
  const aTime = Date.parse(a?.updatedAt || '') || 0;
  const bTime = Date.parse(b?.updatedAt || '') || 0;
  return bTime - aTime || Number(b?.number || 0) - Number(a?.number || 0);
}

function ownerGateEvidence(item) {
  if (item?.source === 'pull-request') return `GitHub PR #${item.prNumber}`;
  if (item?.path && item?.line) return `${item.path} line ${item.line}`;
  return 'explicit GitHub Owner Gate';
}

export function buildSuggestedNext(projectFacts) {
  const gates = Array.isArray(projectFacts?.ownerAttention) ? projectFacts.ownerAttention : [];
  if (gates.length) {
    const item = gates[0];
    return Object.freeze({
      kind: 'OWNER_GATE_RECONCILIATION',
      text: `Reconcile explicit Owner Gate: ${item.title}`,
      reason: 'GitHub explicitly marks an Owner action. GPT should verify the exact evidence before surfacing or acting on the gate.',
      evidence: ownerGateEvidence(item)
    });
  }

  const task = projectFacts?.roadmap?.currentPointers?.task;
  if (task?.value) return Object.freeze({
    kind: 'CURRENT_TASK_RECONCILIATION',
    text: `Reconcile explicit Current Task: ${task.value}`,
    reason: 'The GitHub roadmap contains an exact Current Task label. GPT decides the next execution step after repository/runtime reconciliation.',
    evidence: `${projectFacts.roadmap.path} line ${task.line}`
  });

  const wp = projectFacts?.roadmap?.currentPointers?.workPackage;
  if (wp?.value) return Object.freeze({
    kind: 'CURRENT_WP_RECONCILIATION',
    text: `Reconcile explicit Current Work Package: ${wp.value}`,
    reason: 'The GitHub roadmap contains an exact Current Work Package label but no exact Current Task label.',
    evidence: `${projectFacts.roadmap.path} line ${wp.line}`
  });

  const prs = [...(Array.isArray(projectFacts?.openPullRequests) ? projectFacts.openPullRequests : [])].sort(prSort);
  if (prs.length) {
    const pr = prs[0];
    return Object.freeze({
      kind: 'OPEN_PR_RECONCILIATION',
      text: `Inspect open PR #${pr.number}: ${pr.title}`,
      reason: 'No explicit Current Task/WP is projected, but an open PR exists. Reconcile its exact head, review state and CI in GitHub before deciding whether to continue, revise or merge.',
      evidence: `GitHub PR #${pr.number} · head ${clean(pr.headSha)}`
    });
  }

  if (projectFacts?.roadmap?.path) return Object.freeze({
    kind: 'ROADMAP_REVIEW',
    text: 'Review the GitHub roadmap for the next explicit task.',
    reason: 'No explicit Owner Gate, Current Task, Current Work Package or open PR is available in the projected GitHub facts.',
    evidence: projectFacts.roadmap.path
  });

  return Object.freeze({
    kind: 'GITHUB_RECONCILIATION',
    text: 'Inspect GitHub directly before selecting the next development action.',
    reason: 'AICC has no explicit roadmap pointer or open PR evidence to recommend a narrower check.',
    evidence: clean(projectFacts?.repository)
  });
}

function projectRuntime(runtimeOverview, projectId) {
  const machines = (runtimeOverview?.machines || []).filter((machine) => (machine.projectIds || []).includes(projectId)).map((machine) => Object.freeze({
    id: machine.id,
    name: machine.name,
    role: machine.role,
    status: machine.status,
    reportedStatus: machine.reportedStatus ?? null,
    lastSeen: machine.lastSeen ?? null,
    observations: Object.freeze((machine.observations || []).map((item) => Object.freeze({ repository: item.repository, branch: item.branch, runtime: item.runtime })))
  }));
  return Object.freeze({
    source: runtimeOverview?.source || 'remote-desktop-commander',
    available: Boolean(runtimeOverview?.available),
    observationState: runtimeOverview?.observationState || 'UNAVAILABLE',
    observedAt: runtimeOverview?.observedAt || null,
    machines: Object.freeze(machines)
  });
}

function roadmapSnapshot(roadmap) {
  if (!roadmap) return null;
  return Object.freeze({
    path: roadmap.path,
    title: roadmap.title,
    currentWorkPackage: roadmap.currentWorkPackage,
    currentTask: roadmap.currentTask,
    progress: roadmap.progress,
    currentPointers: roadmap.currentPointers
  });
}

export function buildGptContextSnapshot(projectFacts, runtimeOverview, { now = () => new Date(), uiPreviewPolicy } = {}) {
  if (!projectFacts?.available) throw new Error('project facts unavailable');
  if (uiPreviewPolicy?.id !== UI_PREVIEW_POLICY_ID || uiPreviewPolicy?.status !== 'ACTIVE' || !uiPreviewPolicy?.instruction || !/^[0-9a-f]{40}$/i.test(uiPreviewPolicy?.mainSha || '')) {
    const error = new Error('Canonical global UI preview policy required for GPT Context');
    error.code = 'GLOBAL_UI_PREVIEW_POLICY_UNAVAILABLE';
    throw error;
  }
  const explicitOwnerGates = Object.freeze((projectFacts.ownerAttention || []).map((item) => Object.freeze({
    type: item.type,
    title: item.title,
    source: item.source,
    evidence: ownerGateEvidence(item)
  })));
  return Object.freeze({
    schema: 'aicc.v4.gpt-context.v1',
    generatedAt: now().toISOString(),
    authority: Object.freeze({
      sourceOfTruth: 'GitHub',
      orchestrator: 'GPT',
      aiccRole: 'advisory projection only',
      executionInterfaces: 'GitHub + Remote Desktop Commander'
    }),
    uiPreviewPolicy: Object.freeze({ ...uiPreviewPolicy }),
    project: Object.freeze({ id: projectFacts.projectId, name: projectFacts.name, repository: projectFacts.repository }),
    github: Object.freeze({
      defaultBranch: projectFacts.defaultBranch,
      mainSha: projectFacts.mainSha,
      roadmap: roadmapSnapshot(projectFacts.roadmap),
      openPullRequests: Object.freeze((projectFacts.openPullRequests || []).map((pr) => Object.freeze({ number: pr.number, title: pr.title, draft: pr.draft, state: pr.state, headSha: pr.headSha, baseRef: pr.baseRef, url: pr.url, updatedAt: pr.updatedAt }))),
      defaultBranchCI: projectFacts.ci,
      explicitOwnerGates,
      provenance: projectFacts.provenance
    }),
    runtime: projectRuntime(runtimeOverview, projectFacts.projectId),
    blockers: Object.freeze({ explicitOwnerGates, inferredBlockers: false }),
    suggestedNext: buildSuggestedNext(projectFacts)
  });
}

function ciText(ci) {
  const total = Number(ci?.total || 0);
  if (!total) return 'No checks recorded on the projected default-branch head';
  const success = Number(ci?.byConclusion?.success || 0);
  const failure = Number(ci?.byConclusion?.failure || 0);
  const pending = Number(ci?.byStatus?.in_progress || 0) + Number(ci?.byStatus?.queued || 0);
  return `${total} checks · ${success} success${failure ? ` · ${failure} failed` : ''}${pending ? ` · ${pending} running` : ''}`;
}

function progressText(progress) {
  if (!progress?.available) return '— (no GitHub progress evidence)';
  if (progress.basis === 'markdown-checklist') return `${progress.percentage}% (${progress.completed}/${progress.total} GitHub checklist items)`;
  return `${progress.percentage}% (explicit GitHub Progress label)`;
}

export function formatGptContext(snapshot) {
  const github = snapshot.github;
  const roadmap = github.roadmap;
  const lines = [
    'AICC GPT EXECUTION CONTEXT',
    'Authority: GitHub is the only project Source of Truth. AICC is advisory only. GPT decides and executes through GitHub/DC.',
    'GLOBAL UI PREVIEW FIRST — canonical rule; not execution authorization:',
    `Policy ID: ${snapshot.uiPreviewPolicy.id} · version ${snapshot.uiPreviewPolicy.version} · ${snapshot.uiPreviewPolicy.status}`,
    `Policy source: ${snapshot.uiPreviewPolicy.canonicalRepository}/${snapshot.uiPreviewPolicy.canonicalPath} @ ${snapshot.uiPreviewPolicy.mainSha}`,
    `Policy content SHA-256: ${snapshot.uiPreviewPolicy.contentSha256}`,
    snapshot.uiPreviewPolicy.instruction,
    `Project: ${snapshot.project.name} (${snapshot.project.id})`,
    `Repository: ${snapshot.project.repository}`,
    `Canonical default branch: ${github.defaultBranch}`,
    `Exact default-branch SHA: ${github.mainSha}`,
    `Roadmap: ${roadmap ? `${clean(roadmap.title)} · ${roadmap.path}` : 'not registered'}`,
    `Roadmap progress: ${roadmap ? progressText(roadmap.progress) : '—'}`,
    `Current Work Package: ${roadmap?.currentWorkPackage || 'not explicitly labeled'}`,
    `Current Task: ${roadmap?.currentTask || 'not explicitly labeled'}`,
    `Default-branch CI: ${ciText(github.defaultBranchCI)}`,
    'Open PRs:'
  ];
  if (github.openPullRequests.length) for (const pr of github.openPullRequests) lines.push(`- #${pr.number} [${pr.draft ? 'DRAFT' : 'OPEN'}] ${pr.title} · head ${clean(pr.headSha)}`);
  else lines.push('- none');
  lines.push('Explicit Owner Gates:');
  if (github.explicitOwnerGates.length) for (const gate of github.explicitOwnerGates) lines.push(`- ${gate.type}: ${gate.title} · ${gate.evidence}`);
  else lines.push('- none explicitly projected (AICC does not infer blockers)');
  lines.push(`Runtime evidence: ${snapshot.runtime.observationState} · observed ${snapshot.runtime.observedAt || 'not available'}`);
  if (snapshot.runtime.machines.length) for (const machine of snapshot.runtime.machines) {
    const repoEvidence = machine.observations.map((item) => `${item.repository || 'runtime'}@${item.branch || 'unknown'}${item.runtime ? ` · ${item.runtime}` : ''}`).join('; ');
    lines.push(`- ${machine.name} | ${machine.status} | ${machine.role}${repoEvidence ? ` | ${repoEvidence}` : ''}`);
  } else lines.push('- no project-associated machine in latest observation');
  lines.push(`Suggested Next (ADVISORY): ${snapshot.suggestedNext.text}`);
  lines.push(`Reason: ${snapshot.suggestedNext.reason}`);
  lines.push(`Evidence: ${snapshot.suggestedNext.evidence}`);
  lines.push('Before action: reconcile current GitHub evidence. Do not treat this snapshot as authority if GitHub has advanced.');
  lines.push(`Generated: ${snapshot.generatedAt}`);
  return lines.join('\n');
}

export function createGptContextSnapshot(projectFacts, runtimeOverview, options = {}) {
  const snapshot = buildGptContextSnapshot(projectFacts, runtimeOverview, options);
  return Object.freeze({ ...snapshot, copyText: formatGptContext(snapshot) });
}
