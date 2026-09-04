import {createHash} from 'node:crypto';

export const SUBMISSION_STATES = ['IDLE', 'SUBMITTING_LOCAL', 'TRANSPORT_SENT', 'AICC_ACCEPTED', 'RUN_CREATED', 'RUNNING', 'COMPLETED', 'FAILED', 'SUBMISSION_STALLED'] as const;
export type SubmissionState = typeof SUBMISSION_STATES[number];

export const PENDING_ACK_STATES = ['PENDING', 'UNCONFIRMED', 'ACKNOWLEDGED'] as const;
export type PendingAckState = typeof PENDING_ACK_STATES[number];

export type PendingSubmissionRecord = {
  submission_id: string;
  instruction_id: string;
  payload_hash: string;
  source: string;
  conversation_id?: string;
  created_at: string;
  ack_state: PendingAckState;
  inbox_id?: string;
  task_id?: string;
  execution_id?: string;
  run_id?: string;
};

export type SubmissionIdentity = {
  submissionId: string;
  instructionId?: string;
  taskId?: string;
  executionId?: string;
  runId?: string;
};

export type SubmissionProjection = SubmissionIdentity & {
  state: SubmissionState;
  errorCode?: string;
  updatedAt?: string;
};

export const SUBMISSION_ACK_TIMEOUT_MS = 8_000;

const ALLOWED_TRANSITIONS: Record<SubmissionState, SubmissionState[]> = {
  IDLE: ['SUBMITTING_LOCAL'],
  SUBMITTING_LOCAL: ['TRANSPORT_SENT', 'FAILED'],
  TRANSPORT_SENT: ['AICC_ACCEPTED', 'RUN_CREATED', 'FAILED', 'SUBMISSION_STALLED'],
  AICC_ACCEPTED: ['RUN_CREATED', 'RUNNING', 'COMPLETED', 'FAILED', 'SUBMISSION_STALLED'],
  RUN_CREATED: ['RUNNING', 'COMPLETED', 'FAILED'],
  RUNNING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: [],
  SUBMISSION_STALLED: ['AICC_ACCEPTED', 'RUN_CREATED', 'RUNNING', 'COMPLETED', 'FAILED']
};

export function transitionSubmission(from: SubmissionState, to: SubmissionState): SubmissionState {
  if (from === to || ALLOWED_TRANSITIONS[from].includes(to)) return to;
  throw new Error(`INVALID_SUBMISSION_TRANSITION:${from}->${to}`);
}

export function isExtensionContextUsable(runtime: unknown): boolean {
  try {
    const value = runtime as { runtime?: { id?: string; sendMessage?: unknown } } | null;
    return Boolean(value?.runtime?.id && typeof value.runtime.sendMessage === 'function');
  } catch {
    return false;
  }
}

export function durableAckIdentity(response: unknown): SubmissionIdentity | null {
  const item = (response as { item?: Record<string, unknown> } | null)?.item;
  const instruction = item?.instruction as Record<string, unknown> | undefined;
  const instructionId = typeof item?.instructionId === 'string' ? item.instructionId : typeof instruction?.instructionId === 'string' ? instruction.instructionId : undefined;
  const taskId = typeof item?.taskId === 'string' ? item.taskId : undefined;
  if (!instructionId || !taskId) return null;
  return {
    submissionId: typeof item?.submissionId === 'string' ? item.submissionId : typeof item?.id === 'string' ? item.id : instructionId,
    instructionId,
    taskId,
    executionId: typeof item?.executionId === 'string' ? item.executionId : undefined,
    runId: typeof item?.runId === 'string' ? item.runId : undefined
  };
}

export function hasExecutionIdentity(identity: Pick<SubmissionIdentity, 'executionId' | 'runId'> | null | undefined): boolean {
  return Boolean(identity?.executionId && identity.runId);
}

export function stateAfterDurableAck(identity: SubmissionIdentity, operation: 'SEND_INSTRUCTION' | 'IMPORT_AND_RUN' = 'SEND_INSTRUCTION'): SubmissionState {
  if (operation === 'IMPORT_AND_RUN' && hasExecutionIdentity(identity)) return 'RUN_CREATED';
  return 'AICC_ACCEPTED';
}

export function recoverSubmissionAfterReload(projection: SubmissionProjection): SubmissionProjection {
  const transient: SubmissionState[] = ['SUBMITTING_LOCAL', 'TRANSPORT_SENT'];
  if (transient.includes(projection.state) && !projection.taskId && !hasExecutionIdentity(projection)) {
    return { submissionId: projection.submissionId, state: 'IDLE', updatedAt: new Date().toISOString() };
  }
  return projection;
}

export function newSubmissionId(now = Date.now(), random = Math.random()): string {
  return `aicc-submission-${now.toString(36)}-${Math.floor(random * 0xFFFFFFF).toString(36)}`;
}

export function normalizedSubmissionPayload(value: unknown): string {
  return String(value ?? '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').replace(/\n{2,}/g, '\n').trim();
}

export function submissionPayloadHash(value: unknown): string {
  return createHash('sha256').update(normalizedSubmissionPayload(value)).digest('hex');
}

export function createPendingSubmission(input: {
  submissionId: string;
  instructionId: string;
  payload: string;
  source: string;
  conversationId?: string;
  createdAt?: string;
}): PendingSubmissionRecord {
  return {
    submission_id: input.submissionId,
    instruction_id: input.instructionId,
    payload_hash: submissionPayloadHash(input.payload),
    source: input.source,
    ...(input.conversationId ? {conversation_id: input.conversationId} : {}),
    created_at: input.createdAt ?? new Date().toISOString(),
    ack_state: 'PENDING'
  };
}

export function acknowledgePendingSubmission(record: PendingSubmissionRecord, identity: SubmissionIdentity & {inboxId?: string}): PendingSubmissionRecord {
  return {
    ...record,
    ack_state: 'ACKNOWLEDGED',
    inbox_id: identity.inboxId ?? record.inbox_id,
    task_id: identity.taskId ?? record.task_id,
    execution_id: identity.executionId ?? record.execution_id,
    run_id: identity.runId ?? record.run_id
  };
}

export function markSubmissionUnconfirmed(record: PendingSubmissionRecord): PendingSubmissionRecord {
  return {...record, ack_state: 'UNCONFIRMED'};
}

type CanonicalSubmissionCandidate = {
  id?: string;
  inboxId?: string;
  submissionId?: string;
  executionId?: string;
  runId?: string;
  payloadHash?: string;
  rawInstruction?: string;
  instruction?: {instructionId?: string; sourceType?: string; originContext?: {conversationId?: string}};
};

export function reconcilePendingSubmission(record: PendingSubmissionRecord, candidates: CanonicalSubmissionCandidate[]): CanonicalSubmissionCandidate | null {
  const exact = (predicate: (candidate: CanonicalSubmissionCandidate) => boolean) => candidates.find(predicate) ?? null;
  if (record.inbox_id) {
    const match = exact(candidate => candidate.id === record.inbox_id || candidate.inboxId === record.inbox_id);
    if (match) return match;
  }
  if (record.run_id) {
    const match = exact(candidate => candidate.runId === record.run_id);
    if (match) return match;
  }
  if (record.execution_id) {
    const match = exact(candidate => candidate.executionId === record.execution_id);
    if (match) return match;
  }
  const submission = exact(candidate => candidate.submissionId === record.submission_id || candidate.id === record.submission_id);
  if (submission) return submission;
  return exact(candidate => {
    const payloadHash = candidate.payloadHash ?? (candidate.rawInstruction ? submissionPayloadHash(candidate.rawInstruction) : undefined);
    return candidate.instruction?.instructionId === record.instruction_id
      && payloadHash === record.payload_hash
      && candidate.instruction?.sourceType === record.source
      && (candidate.instruction?.originContext?.conversationId ?? '') === (record.conversation_id ?? '');
  });
}

export function autoLoopTransportFailure(): { state: 'PAUSED'; label: 'AUTO LOOP · BRIDGE INVALIDATED'; code: 'EXTENSION_CONTEXT_INVALIDATED' } {
  return { state: 'PAUSED', label: 'AUTO LOOP · BRIDGE INVALIDATED', code: 'EXTENSION_CONTEXT_INVALIDATED' };
}
