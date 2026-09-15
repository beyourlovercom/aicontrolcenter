export type FactSource<T> = {
  available: boolean;
  value: T | null;
  errorCode: string | null;
};

export type ProjectFact = {
  project: { id: string; name: string };
  repository: {
    identity: string;
    path: string;
    branch: string;
    head: string;
    dirty: boolean;
  };
};

export type ExecutorFact = {
  readiness: {
    ready: boolean;
    errorCode?: string;
    checkedAt?: string;
    path?: string;
    version?: string | null;
    model?: string | null;
    authMode?: string | null;
    doctorStatus?: string | null;
    diagnostics?: Array<{ id: string; status: string; summary: string | null }>;
  };
  activeLease: { runId: string; workerPid?: number | null } | null;
  latestRun: Record<string, unknown> | null;
};

export type PrDeliveryFact = {
  repository: { identity: string; defaultBranch: string; url: string | null; isPrivate: boolean };
  local: { branch: string; head: string; dirty: boolean };
  origin: { url: string; identity: string; remoteHeadSha: string | null; exactHeadMatch: boolean };
  pullRequests: Array<{ number: number; url: string; state: string; isDraft: boolean; headRefName: string; headRefOid: string; baseRefName: string; title: string }>;
  checks: Array<{ id: number; name: string; headSha: string; status: string; conclusion: string | null; detailsUrl: string | null }>;
  draftPrerequisites: { ready: boolean; blockers: string[] };
};

export type WorkFact = {
  workPackages: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
};

export type ExecutorFactsProjection = {
  capturedAt: string;
  project: FactSource<ProjectFact>;
  executor: FactSource<ExecutorFact>;
  prDelivery: FactSource<PrDeliveryFact>;
  work: FactSource<WorkFact>;
};

function errorCode(value: unknown, fallback: string): string {
  if (value && typeof value === 'object' && 'errorCode' in value && typeof (value as { errorCode?: unknown }).errorCode === 'string') {
    return (value as { errorCode: string }).errorCode;
  }
  return fallback;
}

async function readSource<T>(fetcher: typeof fetch, endpoint: string, key: string, fallback: string): Promise<FactSource<T>> {
  try {
    const response = await fetcher(endpoint, { headers: { accept: 'application/json' }, cache: 'no-store' });
    const body = await response.json() as Record<string, unknown>;
    if (!response.ok || body.available === false) {
      return { available: false, value: null, errorCode: errorCode(body, `${fallback}_HTTP_${response.status}`) };
    }
    const value = body[key] as T | undefined;
    if (!value || typeof value !== 'object') return { available: false, value: null, errorCode: `${fallback}_INVALID` };
    return { available: true, value, errorCode: null };
  } catch (error) {
    return { available: false, value: null, errorCode: error instanceof Error ? error.message : fallback };
  }
}

export async function readExecutorFacts(fetcher: typeof fetch = fetch): Promise<ExecutorFactsProjection> {
  const [project, executor, prDelivery, work] = await Promise.all([
    readSource<ProjectFact>(fetcher, '/api/project', 'context', 'PROJECT_FACTS_UNAVAILABLE'),
    readSource<ExecutorFact>(fetcher, '/api/executor', 'executor', 'EXECUTOR_FACTS_UNAVAILABLE'),
    readSource<PrDeliveryFact>(fetcher, '/api/pr-delivery', 'delivery', 'PR_FACTS_UNAVAILABLE'),
    readSource<WorkFact>(fetcher, '/api/work', 'store', 'WORK_FACTS_UNAVAILABLE')
  ]);
  return { capturedAt: new Date().toISOString(), project, executor, prDelivery, work };
}

export function roomRuntimeBinding(
  expectedBranch: string,
  expectedWorktree: string,
  facts: ExecutorFactsProjection | null
): 'MATCH' | 'DRIFT' | 'UNAVAILABLE' {
  const repository = facts?.project.value?.repository;
  if (!facts?.project.available || !repository) return 'UNAVAILABLE';
  return repository.branch === expectedBranch && repository.path === expectedWorktree ? 'MATCH' : 'DRIFT';
}

export type RoomRuntimeFactsInput = {
  projectId: string;
  projectName: string;
  repositoryIdentity: string;
  repositoryPath: string;
  roomId: string;
  workstreamId: string;
};

export async function readRoomExecutorFacts(input: RoomRuntimeFactsInput, fetcher: typeof fetch = fetch): Promise<ExecutorFactsProjection> {
  const response = await fetcher('/api/room-facts', {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, cache: 'no-store',
    body: JSON.stringify(input)
  });
  let body: any = {}; try { body = await response.json(); } catch {}
  if (!response.ok || body.available === false || !body.facts) throw new Error(errorCode(body, `ROOM_RUNTIME_HTTP_${response.status}`));
  return body.facts as ExecutorFactsProjection;
}
