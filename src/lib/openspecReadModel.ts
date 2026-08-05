export const lifecycleStates = [
  'PROPOSED', 'PLANNING', 'READY', 'IMPLEMENTING', 'BLOCKED',
  'VERIFYING', 'VERIFIED', 'ARCHIVED', 'INVALID', 'UNKNOWN'
] as const;

export type LifecycleState = typeof lifecycleStates[number];
export type SourceKind = 'specification' | 'proposal' | 'delta-spec' | 'design' | 'tasks' | 'verification' | 'metadata' | 'unknown';
export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export type SourceFile = {
  path: string;
  kind: SourceKind;
  exists: boolean;
  content?: string;
};

export type Diagnostic = {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  sourcePath?: string;
  impact: string;
};

export type Task = { text: string; checked: boolean; sourcePath: string; line: number };
export type TaskProgress = {
  total: number;
  completed: number;
  remaining: number;
  percentage: number | null;
  tasks: Task[];
};

export type GitEvidence = {
  head: string | null;
  branch: string | null;
  clean: boolean | null;
  source: 'local-git' | 'unavailable';
  availableAt?: string;
};

export type VerificationEvidence = {
  path: string;
  result: 'passed' | 'failed' | 'unknown';
  summary: string;
  source: 'local-report';
};

export type Authority = {
  openspec: { source: string; available: boolean };
  git: { source: 'local-git'; available: boolean };
  remote: { source: 'remote'; available: false; reason: string };
};

export type Evidence = {
  kind: 'git' | 'verification' | 'authority';
  label: string;
  value: string;
  sourcePath?: string;
};

export type WorkPackage = {
  id: string;
  title: string;
  archived: boolean;
  files: SourceFile[];
  sections: { proposal?: string; specifications: string[]; design?: string; tasks?: string };
  progress: TaskProgress | null;
  state: LifecycleState;
  diagnostics: Diagnostic[];
  git: GitEvidence;
  verification: VerificationEvidence[];
  evidence: Evidence[];
};

export type Roadmap = { label: string; sourcePath?: string; workPackages: WorkPackage[] };
export type ReadModel = {
  roadmap: Roadmap;
  activeWorkPackages: WorkPackage[];
  archivedWorkPackages: WorkPackage[];
  selectedWorkPackageId: string | null;
  leftColumn: { roadmap: Roadmap; ambiguous: boolean };
  centerColumn: { workPackage: WorkPackage | null };
  rightColumn: { evidence: Evidence[]; files: SourceFile[]; diagnostics: Diagnostic[]; authority: Authority };
};

export type RepositorySnapshot = {
  files: Record<string, string>;
  git?: Partial<Pick<GitEvidence, 'head' | 'branch' | 'clean' | 'availableAt'>>;
  verificationReports?: Record<string, string>;
  selectedWorkPackageId?: string;
  planningComplete?: boolean;
};

function diagnostic(code: string, message: string, impact: string, sourcePath?: string, severity: DiagnosticSeverity = 'error'): Diagnostic {
  return { code, severity, message, impact, sourcePath };
}

function sourceKind(path: string, root = false): SourceKind {
  if (root && /^openspec\/specs\/[^/]+\/spec\.md$/.test(path)) return 'specification';
  if (path.endsWith('/proposal.md')) return 'proposal';
  if (path.endsWith('/design.md')) return 'design';
  if (path.endsWith('/tasks.md')) return 'tasks';
  if (path.endsWith('/.openspec.yaml')) return 'metadata';
  if (/\/specs\/[^/]+\/spec\.md$/.test(path)) return 'delta-spec';
  return 'unknown';
}

function parseTasks(content: string, path: string): { progress: TaskProgress; diagnostics: Diagnostic[] } {
  const tasks: Task[] = [];
  content.split(/\r?\n/).forEach((line, index) => {
    const match = line.match(/^\s*(?:[-*+]\s+)?\[([ xX])\]\s+(.+?)\s*$/);
    if (match) tasks.push({ text: match[2], checked: match[1].toLowerCase() === 'x', sourcePath: path, line: index + 1 });
  });
  const total = tasks.length;
  const completed = tasks.filter((task) => task.checked).length;
  return {
    progress: { total, completed, remaining: total - completed, percentage: total ? Math.round(completed / total * 100) : null, tasks },
    diagnostics: total ? [] : [diagnostic('EMPTY_TASKS', 'tasks.md contains no checkbox tasks', 'Progress and lifecycle are not computable', path)]
  };
}

function markdownDiagnostics(file: SourceFile, planningComplete: boolean): Diagnostic[] {
  if (!['proposal', 'design', 'tasks', 'delta-spec', 'specification'].includes(file.kind)) return [];
  if (!file.exists) return [diagnostic('MISSING_FILE', `${file.path} is missing`, 'The affected Work Package is incomplete', file.path, planningComplete ? 'error' : 'warning')];
  if (!file.content?.trim()) return [diagnostic('MALFORMED_MARKDOWN', `${file.path} is empty`, 'The affected section cannot be parsed', file.path)];
  const fences = (file.content.match(/^```/gm) ?? []).length;
  return fences % 2 ? [diagnostic('MALFORMED_MARKDOWN', `${file.path} has an unclosed code fence`, 'The affected section may be incomplete', file.path)] : [];
}

function filesForChange(snapshot: RepositorySnapshot, changeId: string, archived: boolean): SourceFile[] {
  const prefix = archived ? `openspec/changes/archive/${changeId}/` : `openspec/changes/${changeId}/`;
  const files: SourceFile[] = Object.keys(snapshot.files)
    .filter((path) => path.startsWith(prefix))
    .map((path) => ({ path, kind: sourceKind(path), exists: true, content: snapshot.files[path] }));
  for (const [name, kind] of [['proposal.md', 'proposal'], ['design.md', 'design'], ['tasks.md', 'tasks']] as const) {
    const path = `${prefix}${name}`;
    if (!files.some((file) => file.path === path)) files.push({ path, kind, exists: false });
  }
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function parseVerification(reports: Record<string, string> | undefined): VerificationEvidence[] {
  return Object.entries(reports ?? {}).map(([path, content]) => {
    const pass = /^(?:RESULT|STATUS)\s*:\s*PASS\s*$/im.test(content);
    const fail = /^(?:RESULT|STATUS)\s*:\s*FAIL\s*$/im.test(content);
    return {
      path,
      source: 'local-report' as const,
      result: pass ? 'passed' : fail ? 'failed' : 'unknown',
      summary: content.split(/\r?\n/).find(Boolean) ?? 'No report summary'
    };
  });
}

function gitEvidence(snapshot: RepositorySnapshot): GitEvidence {
  return snapshot.git?.head || snapshot.git?.branch || snapshot.git?.clean !== undefined
    ? { head: snapshot.git?.head ?? null, branch: snapshot.git?.branch ?? null, clean: snapshot.git?.clean ?? null, source: 'local-git', availableAt: snapshot.git?.availableAt }
    : { head: null, branch: null, clean: null, source: 'unavailable' };
}

function normalizeState(files: SourceFile[], progress: TaskProgress | null, diagnostics: Diagnostic[], archived: boolean, verification: VerificationEvidence[], git: GitEvidence, multipleActive: boolean, planningComplete: boolean): LifecycleState {
  if (archived) return 'ARCHIVED';
  if (multipleActive) return 'BLOCKED';
  if (diagnostics.some((item) => item.severity === 'error')) return 'INVALID';
  if (files.some((file) => file.kind === 'unknown')) return 'UNKNOWN';
  if (!files.some((file) => file.kind === 'proposal' && file.exists)) return files.some((file) => file.kind === 'metadata' && file.exists) ? 'PROPOSED' : 'UNKNOWN';
  if (progress?.total === 0) return 'INVALID';
  if (verification.some((item) => item.result === 'failed')) return 'BLOCKED';
  if (progress?.percentage === 100) {
    if (verification.length === 0) return 'VERIFYING';
    if (verification.some((item) => item.result === 'unknown')) return 'UNKNOWN';
    if (verification.every((item) => item.result === 'passed') && git.clean === true) return 'VERIFIED';
    return 'VERIFYING';
  }
  if (progress && progress.completed > 0) return 'IMPLEMENTING';
  const planningFilesComplete = files.some((file) => file.kind === 'proposal' && file.exists)
    && files.some((file) => file.kind === 'design' && file.exists)
    && files.some((file) => file.kind === 'delta-spec' && file.exists)
    && files.some((file) => file.kind === 'tasks' && file.exists);
  if (planningFilesComplete && progress && progress.total > 0) return 'READY';
  if (planningComplete) return 'INVALID';
  return 'PLANNING';
}

function parseWorkPackage(snapshot: RepositorySnapshot, id: string, archived: boolean, multipleActive: boolean): WorkPackage {
  const files = filesForChange(snapshot, id, archived);
  const diagnostics = files.flatMap((file) => markdownDiagnostics(file, snapshot.planningComplete ?? false));
  if (!files.some((file) => file.kind === 'delta-spec' && file.exists)) {
    diagnostics.push(diagnostic('MISSING_DELTA_SPEC', 'No delta spec was found for this Change', 'The planning contract is incomplete', undefined, snapshot.planningComplete ? 'error' : 'warning'));
  }
  const taskFile = files.find((file) => file.kind === 'tasks' && file.exists);
  let progress: TaskProgress | null = null;
  if (taskFile?.content !== undefined) {
    const parsed = parseTasks(taskFile.content, taskFile.path);
    progress = parsed.progress;
    diagnostics.push(...parsed.diagnostics);
  }
  const verification = parseVerification(snapshot.verificationReports);
  if (verification.some((item) => item.result === 'unknown')) diagnostics.push(diagnostic('UNKNOWN_VERIFICATION_RESULT', 'Verification report format is unsupported', 'Lifecycle cannot claim verification success', undefined, 'warning'));
  const git = gitEvidence(snapshot);
  const state = normalizeState(files, progress, diagnostics, archived, verification, git, multipleActive, snapshot.planningComplete ?? false);
  const evidence: Evidence[] = [
    { kind: 'authority', label: 'OpenSpec', value: state, sourcePath: files.find((file) => file.kind === 'proposal')?.path },
    { kind: 'git', label: 'Local Git', value: git.source === 'local-git' ? `${git.branch ?? 'detached'} · ${git.head ?? 'HEAD unavailable'} · ${git.clean === true ? 'clean' : git.clean === false ? 'dirty' : 'unknown'}` : 'unavailable' },
    ...verification.map((item) => ({ kind: 'verification' as const, label: 'Verification', value: `${item.result}: ${item.summary}`, sourcePath: item.path }))
  ];
  return { id, title: files.find((file) => file.kind === 'proposal')?.content?.match(/^#\s+(.+)$/m)?.[1] ?? id, archived, files, sections: { proposal: files.find((file) => file.kind === 'proposal' && file.exists)?.content, specifications: files.filter((file) => file.kind === 'delta-spec' && file.exists).map((file) => file.content ?? ''), design: files.find((file) => file.kind === 'design' && file.exists)?.content, tasks: taskFile?.content }, progress, state, diagnostics, git, verification, evidence };
}

export function buildReadModel(snapshot: RepositorySnapshot): ReadModel {
  const activeIds = new Set<string>();
  const archivedIds = new Set<string>();
  for (const path of Object.keys(snapshot.files)) {
    const archived = path.match(/^openspec\/changes\/archive\/([^/]+)\//);
    const active = path.match(/^openspec\/changes\/([^/]+)\//);
    if (archived) archivedIds.add(archived[1]);
    else if (active && active[1] !== 'archive') activeIds.add(active[1]);
  }
  const multipleActive = activeIds.size > 1;
  const activeWorkPackages = [...activeIds].sort().map((id) => parseWorkPackage(snapshot, id, false, multipleActive));
  const archivedWorkPackages = [...archivedIds].sort().map((id) => parseWorkPackage(snapshot, id, true, false));
  const allSpecs = Object.keys(snapshot.files)
    .filter((path) => /^openspec\/specs\/[^/]+\/spec\.md$/.test(path))
    .map((path) => ({ path, kind: 'specification' as const, exists: true, content: snapshot.files[path] }));
  const roadmap: Roadmap = { label: 'AI Control Center', sourcePath: 'docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md', workPackages: activeWorkPackages };
  const selectedWorkPackageId = snapshot.selectedWorkPackageId && activeIds.has(snapshot.selectedWorkPackageId) ? snapshot.selectedWorkPackageId : multipleActive ? null : activeWorkPackages[0]?.id ?? null;
  const selected = activeWorkPackages.find((item) => item.id === selectedWorkPackageId) ?? null;
  const diagnostics = activeWorkPackages.flatMap((item) => item.diagnostics);
  if (multipleActive) diagnostics.push(diagnostic('AMBIGUOUS_ACTIVE_CHANGE', 'Multiple active Changes are present', 'No Work Package is selected silently'));
  const authority: Authority = { openspec: { source: allSpecs[0]?.path ?? 'openspec/specs/', available: allSpecs.length > 0 }, git: { source: 'local-git', available: selected?.git.source === 'local-git' }, remote: { source: 'remote', available: false, reason: 'Remote Authority is intentionally unavailable in the read-only adapter' } };
  return { roadmap, activeWorkPackages, archivedWorkPackages, selectedWorkPackageId, leftColumn: { roadmap, ambiguous: multipleActive }, centerColumn: { workPackage: selected }, rightColumn: { evidence: selected?.evidence ?? [], files: [...allSpecs, ...(selected?.files ?? [])], diagnostics, authority } };
}
