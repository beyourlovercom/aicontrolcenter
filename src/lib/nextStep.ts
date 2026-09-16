import type { ChatgptConversationSnapshot } from './chatgptProjection.ts';
import { roomRuntimeBinding, type ExecutorFactsProjection } from './executorFacts.ts';
import type { ExecutionRoomState } from './executionRoomState.ts';

export type NextStepStateName = 'PENDING' | 'CLAIMED' | 'EXECUTION_QUEUED' | 'STOP_GATE' | 'ABORTED_BEFORE_SEND' | 'UNCERTAIN';
export type NextStepProjection = {
  request: { requestId: string; roomId: string; conversationId: string; promptSha256: string; createdAt: string } & Record<string, unknown>;
  state: { requestId: string; state: NextStepStateName; bridgeRequestId?: string | null; runId?: string | null; decision?: Record<string, unknown> | null; errorCode?: string | null; updatedAt: string };
};
export type NextStepEligibility = { ready: boolean; blockers: string[] };
export const NEXT_STEP_SNAPSHOT_MAX_AGE_MS = 90_000;
const NEXT_STEP_SNAPSHOT_FUTURE_SKEW_MS = 5_000;

function freshSnapshot(snapshot: ChatgptConversationSnapshot | null, nowMs: number): boolean {
  if (!snapshot) return false;
  const capturedAt = Date.parse(snapshot.capturedAt);
  if (!Number.isFinite(capturedAt)) return false;
  const age = nowMs - capturedAt;
  return age <= NEXT_STEP_SNAPSHOT_MAX_AGE_MS && age >= -NEXT_STEP_SNAPSHOT_FUTURE_SKEW_MS;
}

export function nextStepEligibility(room: ExecutionRoomState, facts: ExecutorFactsProjection | null, snapshot: ChatgptConversationSnapshot | null, nowMs: number = Date.now()): NextStepEligibility {
  const blockers: string[] = [];
  if (!room.gptConversationBinding || !room.gptConversationUrl) blockers.push('GPT_UNBOUND');
  if (!snapshot || snapshot.conversationId !== room.gptConversationBinding || !freshSnapshot(snapshot, nowMs)) blockers.push('GPT_SNAPSHOT_STALE');
  if (roomRuntimeBinding(room.branch, room.worktree, facts) !== 'MATCH') blockers.push('RUNTIME_DRIFT');
  const repository = facts?.project.value?.repository;
  if (!facts?.project.available || !repository) blockers.push('PROJECT_FACTS_UNAVAILABLE');
  else if (repository.dirty) blockers.push('WORKTREE_DIRTY');
  const executor = facts?.executor.value;
  if (!facts?.executor.available || !executor?.readiness.ready) blockers.push('EXECUTOR_NOT_READY');
  if (executor?.activeLease?.runId) blockers.push('EXECUTOR_BUSY');
  return { ready: blockers.length === 0, blockers };
}

async function jsonResponse(response: Response) {
  let value: any = {}; try { value = await response.json(); } catch {}
  if (!response.ok) throw new Error(value.errorCode || `HTTP_${response.status}`);
  return value;
}
export async function submitNextStep(room: ExecutionRoomState, draft: string, fetcher: typeof fetch = fetch): Promise<NextStepProjection> {
  const response = await fetcher('/api/next-step/requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
    roomId: room.roomId, roomName: room.name, projectId: room.projectId, repositoryIdentity: room.repo, workstreamId: room.workstreamId, branch: room.branch, worktree: room.worktree,
    conversationId: room.gptConversationBinding, draft
  }) });
  const value = await jsonResponse(response); return { request: value.request, state: value.state };
}
export async function readNextStep(requestId: string, fetcher: typeof fetch = fetch): Promise<NextStepProjection> {
  const value = await jsonResponse(await fetcher(`/api/next-step/requests/${encodeURIComponent(requestId)}`));
  return { request: value.request, state: value.state };
}
export function nextStepStatusLabel(value: NextStepProjection | null): string {
  if (!value) return 'READY';
  const state = value.state.state;
  if (state === 'PENDING') return '等待 Profile 12 Bridge';
  if (state === 'CLAIMED') return 'GPT 正在决定 exact next task';
  if (state === 'EXECUTION_QUEUED') return '执行器已进入 managed execution';
  if (state === 'STOP_GATE') return 'STOP Gate · 等待 Owner';
  if (state === 'ABORTED_BEFORE_SEND') return '未发送 · 可安全重试';
  return 'UNCERTAIN · 禁止自动重放';
}

export async function cancelPendingNextStepForRoom(roomId: string, fetcher: typeof fetch = fetch): Promise<{cancelled:string[];claimed:string[]}> {
  const value = await jsonResponse(await fetcher(`/api/next-step/rooms/${encodeURIComponent(roomId)}/cancel-pending`, { method: 'POST' }));
  return { cancelled: Array.isArray(value.cancelled) ? value.cancelled : [], claimed: Array.isArray(value.claimed) ? value.claimed : [] };
}
