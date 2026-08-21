import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {resolveAiccStateDir} from './stateDirectory.ts';
import {parseExecutionV1, type BridgeReport, type ExecutionInstruction, type InboxItem, type ExecutionSourceType} from './bridgeCore.ts';

export const GPT_AUTO_CONTROL_LOOP = 'GPT_AUTO_CONTROL_LOOP' as const;
export const CONTROL_CONTRACT_TYPES = ['AICC_EXECUTION_V1', 'AICC_OWNER_UAT_V1', 'AICC_WP_COMPLETE_V1', 'AICC_BLOCKED_V1'] as const;
export type ControlContractType = typeof CONTROL_CONTRACT_TYPES[number];
export type ControlContractClass = 'EXECUTABLE_CONTROL' | 'TERMINAL_OWNER_UAT' | 'TERMINAL_COMPLETE' | 'TERMINAL_BLOCKED';
export type GptAutoControlLoopMode = 'ON' | 'OFF';
export const EXECUTION_STATUSES = ['SUBMITTING', 'STARTING', 'RUNNING', 'COMPLETED', 'FAILED'] as const;
export type ExecutionStatus = typeof EXECUTION_STATUSES[number];
export const FEEDBACK_DELIVERY_STATUSES = ['NOT_READY', 'READY', 'RESOLVING_TARGET', 'DELIVERING', 'DELIVERED', 'DELIVERY_FAILED', 'CORRELATION_FAILED'] as const;
export type FeedbackDeliveryStatus = typeof FEEDBACK_DELIVERY_STATUSES[number];
export const CONTROL_LOOP_STATUSES = ['RUNNING', 'WAITING_FEEDBACK_DELIVERY', 'WAITING_NEXT_CONTROL', 'CONTINUING', 'WAITING_OWNER_UAT', 'BLOCKED', 'COMPLETE', 'PAUSED'] as const;
export type CanonicalControlLoopStatus = typeof CONTROL_LOOP_STATUSES[number];
export type AutoLoopStatus = 'OFF' | 'WAITING_GPT' | 'GPT_CONTROL_RECEIVED' | 'SUBMITTING_AICC' | 'RUNNING_LUNA' | 'RESULT_READY' | 'RETURNING_FEEDBACK' | 'FEEDBACK_INSERTED' | 'FEEDBACK_SUBMITTING' | 'FEEDBACK_SUBMITTED' | 'FEEDBACK_DELIVERY_FAILED' | 'WAITING_OWNER_UAT' | 'BLOCKED' | 'COMPLETE' | 'PAUSED' | 'STOPPED_BY_OWNER';
export type FeedbackLifecycle = 'FEEDBACK_READY' | 'FEEDBACK_CLAIMED' | 'FEEDBACK_INSERTING' | 'FEEDBACK_INSERTED' | 'FEEDBACK_SUBMITTING' | 'FEEDBACK_SUBMITTED' | 'FEEDBACK_CONSUMED' | 'FEEDBACK_DELIVERY_FAILED' | 'FEEDBACK_CORRELATION_FAILED';
export type ControlLifecycle = 'GPT_CONTROL_DETECTED' | 'CONTROL_CLAIMED' | 'SUBMITTED_TO_AICC' | 'EXECUTION_STARTED' | 'CONTROL_CONSUMED' | 'CONTROL_CONTRACT_INVALID';

export type ControlLoopRecord = {
  control_loop_id: string;
  formal_wp_id: string;
  conversation_id: string;
  binding_epoch: number;
  bound_at: string;
  binding_active: boolean;
  binding_assistant_message_ids: string[];
  binding_control_message_hashes: string[];
  enabled: boolean;
  mode: GptAutoControlLoopMode;
  status: AutoLoopStatus;
  execution_status: ExecutionStatus;
  feedback_delivery_status: FeedbackDeliveryStatus;
  control_loop_status: CanonicalControlLoopStatus;
  created_at: string;
  updated_at: string;
  current_task?: string;
  run_id?: string;
  execution_id?: string;
  runtime?: string;
  executor?: 'LUNA';
  model?: string;
  reasoning_effort?: string;
  model_source?: string;
  last_feedback_state?: FeedbackLifecycle;
  last_control_type?: ControlContractType;
  last_assistant_message_id?: string;
  last_control_message_hash?: string;
  last_response_evidence?: string;
  blocker_code?: string;
  owner_uat_request?: string;
  owner_click_count_after_round_1?: number;
  correlation_recovery_attempts?: number;
  delivery_retry_attempts?: number;
};

export type FeedbackEnvelopeInput = {
  control_loop_id: string;
  formal_wp_id: string;
  current_pr_id?: string | null;
  task_id?: string | null;
  instruction_id?: string | null;
  execution_id: string;
  run_id: string;
  source?: string;
  runtime?: string;
  model?: string;
  result_id: string;
  result_hash: string;
  execution_result: string;
  binding_epoch?: number;
  feedback_id?: string;
  expected_gpt_turn_id?: string;
  next_control_contract_id?: string;
};

export type FeedbackRecord = FeedbackEnvelopeInput & {
  conversation_id: string;
  feedback_key: string;
  feedback_id: string;
  expected_gpt_turn_id: string;
  lifecycle: FeedbackLifecycle;
  envelope: string;
  created_at: string;
  updated_at: string;
  delivery_attempts?: number;
  submission_claimed_at?: string;
  submitted_at?: string;
  failure_reason?: string;
  correlation_recovery_attempts?: number;
};

export type ControlClaim = {
  control_loop_id: string;
  conversation_id: string;
  binding_epoch: number;
  feedback_key?: string;
  expected_gpt_turn_id?: string;
  next_control_contract_id?: string;
  assistant_message_id: string;
  control_message_hash: string;
  instruction_id?: string | null;
  contract_type: ControlContractType;
  contract_class: ControlContractClass;
  lifecycle: ControlLifecycle;
  response: string;
  created_at: string;
  updated_at: string;
  inbox_id?: string;
  execution_id?: string;
  run_id?: string;
  invalid_code?: string;
};

export type ExpectedControlTurn = {
  control_loop_id: string;
  binding_epoch: number;
  conversation_id: string;
  feedback_key: string;
  feedback_id: string;
  expected_gpt_turn_id: string;
  next_control_contract_id: string;
  feedback_message_id: string;
  result_id: string;
  result_hash: string;
  created_at: string;
  updated_at: string;
  state: 'PENDING' | 'GPT_CONTROL_RECEIVED' | 'SUBMITTING_AICC' | 'CONSUMED' | 'FAILED';
  assistant_message_id?: string;
  control_message_hash?: string;
  instruction_id?: string | null;
  failure_code?: string;
};

type PersistedState = {loops: ControlLoopRecord[]; feedback: FeedbackRecord[]; controls: ControlClaim[]; expected_turns: ExpectedControlTurn[]};
const stateFile = join(resolveAiccStateDir(), 'gpt-auto-control-loop.json');
const now = () => new Date().toISOString();

export const FEEDBACK_CORRELATION_AUTHORITY = Object.freeze(['CONTROL_LOOP_ID', 'BINDING_EPOCH', 'EXPECTED_GPT_TURN_ID'] as const);

function stableId(prefix: string, parts: string[]): string {
  return `${prefix}-${createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 24)}`;
}

export function expectedGptTurnId(control_loop_id: string, binding_epoch: number, feedback_id: string): string {
  return stableId('gpt-turn', [requireText(control_loop_id, 'CONTROL_LOOP_ID_REQUIRED'), String(binding_epoch), requireText(feedback_id, 'FEEDBACK_ID_REQUIRED')]);
}

export function nextControlContractId(expected_gpt_turn_id: string): string {
  return stableId('next-control', [requireText(expected_gpt_turn_id, 'EXPECTED_GPT_TURN_ID_REQUIRED')]);
}

export function buildFeedbackCorrelationAuthority(input: {control_loop_id: string; binding_epoch: number; expected_gpt_turn_id: string}): {control_loop_id: string; binding_epoch: number; expected_gpt_turn_id: string; key: string} {
  const control_loop_id = requireText(input.control_loop_id, 'CONTROL_LOOP_ID_REQUIRED');
  const expected_gpt_turn_id = requireText(input.expected_gpt_turn_id, 'EXPECTED_GPT_TURN_ID_REQUIRED');
  if (!Number.isInteger(input.binding_epoch) || input.binding_epoch < 1) throw new Error('BINDING_EPOCH_REQUIRED');
  return {control_loop_id, binding_epoch: input.binding_epoch, expected_gpt_turn_id, key: [control_loop_id, input.binding_epoch, expected_gpt_turn_id].join(':')};
}

function executionStatusForLegacy(status: AutoLoopStatus): ExecutionStatus {
  if (status === 'SUBMITTING_AICC') return 'SUBMITTING';
  if (status === 'RUNNING_LUNA') return 'RUNNING';
  if (status === 'FEEDBACK_DELIVERY_FAILED' || status === 'BLOCKED' || status === 'PAUSED' || status === 'STOPPED_BY_OWNER') return 'FAILED';
  if (status === 'COMPLETE' || status === 'WAITING_OWNER_UAT') return 'COMPLETED';
  return 'STARTING';
}

function feedbackStatusForLifecycle(lifecycle: FeedbackLifecycle | undefined): FeedbackDeliveryStatus {
  if (!lifecycle) return 'NOT_READY';
  if (lifecycle === 'FEEDBACK_READY') return 'READY';
  if (lifecycle === 'FEEDBACK_CLAIMED') return 'RESOLVING_TARGET';
  if (lifecycle === 'FEEDBACK_INSERTING' || lifecycle === 'FEEDBACK_INSERTED' || lifecycle === 'FEEDBACK_SUBMITTING') return 'DELIVERING';
  if (lifecycle === 'FEEDBACK_SUBMITTED' || lifecycle === 'FEEDBACK_CONSUMED') return 'DELIVERED';
  if (lifecycle === 'FEEDBACK_CORRELATION_FAILED') return 'CORRELATION_FAILED';
  return 'DELIVERY_FAILED';
}

function controlStatusForLegacy(status: AutoLoopStatus, feedback: FeedbackDeliveryStatus): CanonicalControlLoopStatus {
  if (status === 'WAITING_OWNER_UAT') return 'WAITING_OWNER_UAT';
  if (status === 'BLOCKED') return 'BLOCKED';
  if (status === 'COMPLETE') return 'COMPLETE';
  if (status === 'PAUSED' || status === 'STOPPED_BY_OWNER' || feedback === 'CORRELATION_FAILED' || feedback === 'DELIVERY_FAILED') return 'PAUSED';
  if (status === 'WAITING_GPT' || status === 'FEEDBACK_SUBMITTED' || status === 'FEEDBACK_INSERTED') return 'WAITING_NEXT_CONTROL';
  if (status === 'RETURNING_FEEDBACK' || status === 'RESULT_READY') return 'WAITING_FEEDBACK_DELIVERY';
  if (status === 'SUBMITTING_AICC' || status === 'GPT_CONTROL_RECEIVED') return 'CONTINUING';
  return 'RUNNING';
}

function readState(): PersistedState {
  try {
    const value = JSON.parse(readFileSync(stateFile, 'utf8')) as Partial<PersistedState>;
    const loops = Array.isArray(value.loops) ? value.loops.map(loop => {
      const status = loop.status as AutoLoopStatus;
      const feedback_delivery_status = loop.feedback_delivery_status ?? feedbackStatusForLifecycle(loop.last_feedback_state);
      return {...loop, binding_epoch: Number.isInteger(loop.binding_epoch) && loop.binding_epoch > 0 ? loop.binding_epoch : 1, bound_at: loop.bound_at || loop.created_at, binding_active: loop.binding_active !== false, binding_assistant_message_ids: Array.isArray(loop.binding_assistant_message_ids) ? loop.binding_assistant_message_ids : [], binding_control_message_hashes: Array.isArray(loop.binding_control_message_hashes) ? loop.binding_control_message_hashes : [], execution_status: loop.execution_status ?? executionStatusForLegacy(status), feedback_delivery_status, control_loop_status: loop.control_loop_status ?? controlStatusForLegacy(status, feedback_delivery_status), correlation_recovery_attempts: loop.correlation_recovery_attempts ?? 0, delivery_retry_attempts: loop.delivery_retry_attempts ?? 0};
    }) : [];
    const feedback = Array.isArray(value.feedback) ? value.feedback.map(record => {
      const lifecycle = String(record.lifecycle);
      const normalizedLifecycle = lifecycle === 'GPT_SUBMITTING' ? 'FEEDBACK_SUBMITTING' : lifecycle === 'GPT_SUBMITTED' ? 'FEEDBACK_SUBMITTED' : lifecycle;
      const persistedBindingEpoch = record.binding_epoch;
      const binding_epoch: number = typeof persistedBindingEpoch === 'number' && Number.isInteger(persistedBindingEpoch) && persistedBindingEpoch > 0 ? persistedBindingEpoch : 1;
      const feedback_id = record.feedback_id ?? stableId('feedback', [record.control_loop_id, String(binding_epoch), record.execution_id, record.result_id, record.result_hash]);
      const expected_gpt_turn_id = record.expected_gpt_turn_id ?? expectedGptTurnId(record.control_loop_id, binding_epoch, feedback_id);
      return {...record, binding_epoch, feedback_id, expected_gpt_turn_id, lifecycle: normalizedLifecycle} as FeedbackRecord;
    }) : [];
    const controls = Array.isArray(value.controls) ? value.controls.map(control => ({...control, binding_epoch: Number.isInteger(control.binding_epoch) && control.binding_epoch > 0 ? control.binding_epoch : 1, contract_class: control.contract_class ?? classifyControlContract(control.contract_type)})) : [];
    const expected_turns = Array.isArray(value.expected_turns) ? value.expected_turns.map(turn => {
      const feedback_id = turn.feedback_id ?? stableId('feedback', [turn.control_loop_id, String(turn.binding_epoch), turn.result_id, turn.result_hash]);
      const expected_gpt_turn_id = turn.expected_gpt_turn_id ?? expectedGptTurnId(turn.control_loop_id, turn.binding_epoch, feedback_id);
      return {...turn, feedback_id, expected_gpt_turn_id, next_control_contract_id: turn.next_control_contract_id ?? nextControlContractId(expected_gpt_turn_id)};
    }) : [];
    return {loops, feedback, controls, expected_turns};
  } catch {
    return {loops: [], feedback: [], controls: [], expected_turns: []};
  }
}

function writeState(state: PersistedState): void {
  mkdirSync(resolveAiccStateDir(), {recursive: true});
  const temporary = `${stateFile}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(state, null, 2), {mode: 0o600});
  renameSync(temporary, stateFile);
}

function requireText(value: unknown, code: string): string {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(code);
  return text;
}

export function hashControlMessage(value: string): string {
  return createHash('sha256').update(String(value).replace(/\r\n?/g, '\n').trim()).digest('hex');
}

export function systemManagedControlLoopId(conversation_id: string): string {
  return `aicc-v2-conversation-${createHash('sha256').update(requireText(conversation_id, 'CONVERSATION_ID_REQUIRED')).digest('hex').slice(0, 20)}`;
}

type VisibleAssistantControl = {assistant_message_id: string; response: string};

function bindingBoundary(controls: VisibleAssistantControl[] | undefined): {ids: string[]; hashes: string[]} {
  const valid = Array.isArray(controls) ? controls.filter(item => String(item?.assistant_message_id || '').trim() && String(item?.response || '').trim()) : [];
  return {ids: [...new Set(valid.map(item => String(item.assistant_message_id).trim()))], hashes: [...new Set(valid.map(item => hashControlMessage(item.response)))]};
}

export function bindControlLoop(input: {control_loop_id: string; formal_wp_id: string; conversation_id: string; current_task?: string; visible_assistant_controls?: VisibleAssistantControl[]}): ControlLoopRecord {
  const control_loop_id = requireText(input.control_loop_id, 'CONTROL_LOOP_ID_REQUIRED');
  const formal_wp_id = requireText(input.formal_wp_id, 'FORMAL_WP_ID_REQUIRED');
  const conversation_id = requireText(input.conversation_id, 'CONVERSATION_ID_REQUIRED');
  const state = readState();
  const existing = state.loops.find(loop => loop.control_loop_id === control_loop_id);
  if (existing && (existing.formal_wp_id !== formal_wp_id || existing.conversation_id !== conversation_id)) throw new Error('CONTROL_LOOP_BINDING_IMMUTABLE');
  if (existing) return existing;
  const timestamp = now();
  const boundary = bindingBoundary(input.visible_assistant_controls);
  const loop: ControlLoopRecord = {control_loop_id, formal_wp_id, conversation_id, binding_epoch: 1, bound_at: timestamp, binding_active: true, binding_assistant_message_ids: boundary.ids, binding_control_message_hashes: boundary.hashes, enabled: false, mode: 'OFF', status: 'OFF', execution_status: 'STARTING', feedback_delivery_status: 'NOT_READY', control_loop_status: 'PAUSED', created_at: timestamp, updated_at: timestamp, current_task: input.current_task, executor: 'LUNA', owner_click_count_after_round_1: 0, correlation_recovery_attempts: 0, delivery_retry_attempts: 0};
  state.loops.unshift(loop);
  writeState(state);
  return loop;
}

export function rebindControlLoop(input: {control_loop_id: string; formal_wp_id: string; conversation_id: string; visible_assistant_controls?: VisibleAssistantControl[]}): ControlLoopRecord {
  const control_loop_id = requireText(input.control_loop_id, 'CONTROL_LOOP_ID_REQUIRED');
  const formal_wp_id = requireText(input.formal_wp_id, 'FORMAL_WP_ID_REQUIRED');
  const conversation_id = requireText(input.conversation_id, 'CONVERSATION_ID_REQUIRED');
  const state = readState();
  const loop = state.loops.find(item => item.control_loop_id === control_loop_id);
  if (!loop) return bindControlLoop(input);
  if (loop.formal_wp_id !== formal_wp_id) throw new Error('CONTROL_LOOP_FORMAL_WP_IMMUTABLE');
  const timestamp = now();
  const boundary = bindingBoundary(input.visible_assistant_controls);
  loop.conversation_id = conversation_id;
  loop.binding_epoch += 1;
  loop.bound_at = timestamp;
  loop.binding_active = true;
  loop.binding_assistant_message_ids = boundary.ids;
  loop.binding_control_message_hashes = boundary.hashes;
  for (const turn of state.expected_turns) {
    if (turn.control_loop_id === loop.control_loop_id && turn.state !== 'CONSUMED' && turn.state !== 'FAILED') {
      turn.state = 'FAILED';
      turn.failure_code = 'STALE_BINDING_EPOCH';
      turn.updated_at = timestamp;
    }
  }
  loop.status = loop.enabled ? 'WAITING_GPT' : 'OFF';
  loop.execution_status = 'STARTING';
  loop.feedback_delivery_status = 'NOT_READY';
  loop.control_loop_status = loop.enabled ? 'WAITING_NEXT_CONTROL' : 'PAUSED';
  loop.updated_at = timestamp;
  loop.current_task = undefined;
  loop.run_id = undefined;
  loop.execution_id = undefined;
  loop.last_feedback_state = undefined;
  loop.last_control_type = undefined;
  loop.last_assistant_message_id = undefined;
  loop.last_control_message_hash = undefined;
  loop.last_response_evidence = undefined;
  loop.blocker_code = undefined;
  loop.owner_uat_request = undefined;
  loop.owner_click_count_after_round_1 = 0;
  writeState(state);
  return loop;
}

export function unlockControlLoop(control_loop_id: string): ControlLoopRecord {
  const state = readState();
  const loop = state.loops.find(item => item.control_loop_id === requireText(control_loop_id, 'CONTROL_LOOP_ID_REQUIRED'));
  if (!loop) throw new Error('CONTROL_LOOP_UNBIND_FAILED');
  loop.binding_active = false;
  loop.updated_at = now();
  writeState(state);
  return loop;
}

export function enableControlLoop(control_loop_id: string, enabled: boolean): ControlLoopRecord {
  const state = readState();
  const loop = state.loops.find(item => item.control_loop_id === control_loop_id);
  if (!loop) throw new Error('CONTROL_LOOP_NOT_FOUND');
  if (enabled && !loop.binding_active) throw new Error('CONTROL_LOOP_NOT_BOUND');
  if (enabled) {
    for (const other of state.loops) {
      if (other.control_loop_id === control_loop_id || other.conversation_id !== loop.conversation_id || !other.enabled) continue;
      other.enabled = false;
      other.mode = 'OFF';
      if (!['WAITING_OWNER_UAT', 'BLOCKED', 'COMPLETE', 'PAUSED'].includes(other.status)) other.status = 'OFF';
      other.updated_at = now();
    }
  }
  loop.enabled = Boolean(enabled);
  loop.mode = enabled ? 'ON' : 'OFF';
  if (!enabled && !['WAITING_OWNER_UAT', 'BLOCKED', 'COMPLETE'].includes(loop.status)) loop.status = 'OFF';
  if (enabled && loop.status === 'OFF') loop.status = 'WAITING_GPT';
  loop.updated_at = now();
  writeState(state);
  return loop;
}

export function stopControlLoopByOwner(control_loop_id: string): ControlLoopRecord {
  const state = readState();
  const loop = state.loops.find(item => item.control_loop_id === control_loop_id);
  if (!loop) throw new Error('CONTROL_LOOP_NOT_FOUND');
  loop.enabled = false;
  loop.mode = 'OFF';
  loop.status = 'STOPPED_BY_OWNER';
  loop.control_loop_status = 'PAUSED';
  loop.execution_status = 'FAILED';
  loop.blocker_code = 'STOPPED_BY_OWNER';
  loop.updated_at = now();
  writeState(state);
  return loop;
}

export function resumeControlLoopByOwner(input: {control_loop_id: string; run_id: string; instruction_text: string; submit: (instruction_text: string, loop: ControlLoopRecord) => InboxItem}): {loop: ControlLoopRecord; item: InboxItem} {
  const state = readState();
  const loop = state.loops.find(item => item.control_loop_id === input.control_loop_id);
  if (!loop) throw new Error('CONTROL_LOOP_NOT_FOUND');
  if (!loop.binding_active || loop.conversation_id.length === 0) throw new Error('CONTROL_LOOP_NOT_BOUND');
  if (loop.status !== 'STOPPED_BY_OWNER' || loop.enabled || loop.mode !== 'OFF') throw new Error('RESUME_NOT_OWNER_STOPPED');
  if (loop.run_id !== input.run_id) throw new Error('RESUME_RUN_BINDING_MISMATCH');
  if (!input.instruction_text.trim()) throw new Error('RESUME_INSTRUCTION_UNAVAILABLE');
  loop.enabled = true;
  loop.mode = 'ON';
  loop.status = 'SUBMITTING_AICC';
  loop.execution_status = 'SUBMITTING';
  loop.control_loop_status = 'CONTINUING';
  loop.blocker_code = undefined;
  loop.updated_at = now();
  writeState(state);
  try {
    const item = input.submit(input.instruction_text, loop);
    if (!item.runId || item.runId === input.run_id) throw new Error('RESUME_NEW_RUN_NOT_CREATED');
    const latest = readState();
    const persisted = latest.loops.find(candidate => candidate.control_loop_id === loop.control_loop_id);
    if (!persisted) throw new Error('CONTROL_LOOP_NOT_FOUND');
    persisted.enabled = true;
    persisted.mode = 'ON';
    persisted.status = 'RUNNING_LUNA';
    persisted.execution_status = 'RUNNING';
    persisted.control_loop_status = 'RUNNING';
    persisted.binding_epoch = loop.binding_epoch;
    persisted.conversation_id = loop.conversation_id;
    persisted.run_id = item.runId;
    persisted.execution_id = item.executionId ?? item.runId;
    persisted.executor = 'LUNA';
    persisted.runtime = 'CODEX_CLI';
    persisted.current_task = persisted.current_task ?? persisted.formal_wp_id;
    persisted.model = item.model ?? persisted.model;
    persisted.reasoning_effort = item.reasoning_effort ?? persisted.reasoning_effort;
    persisted.model_source = item.model_source ?? persisted.model_source;
    persisted.updated_at = now();
    writeState(latest);
    return {loop: persisted, item};
  } catch (error) {
    const latest = readState();
    const persisted = latest.loops.find(candidate => candidate.control_loop_id === loop.control_loop_id);
    if (persisted) {
      persisted.enabled = false;
      persisted.mode = 'OFF';
      persisted.status = 'STOPPED_BY_OWNER';
      persisted.execution_status = 'FAILED';
      persisted.control_loop_status = 'PAUSED';
      persisted.blocker_code = error instanceof Error ? error.message : 'RESUME_FAILED';
      persisted.updated_at = now();
      writeState(latest);
    }
    throw error;
  }
}

export function readControlLoops(): ControlLoopRecord[] { return readState().loops; }
export function readControlLoop(control_loop_id: string): ControlLoopRecord | null { return readState().loops.find(loop => loop.control_loop_id === control_loop_id) ?? null; }
export function readControlLoopByConversation(conversation_id: string): ControlLoopRecord | null {
  const matches = readState().loops.filter(loop => loop.conversation_id === conversation_id);
  return matches.find(loop => loop.binding_active) ?? matches[0] ?? null;
}
export function readExpectedControlTurn(input: string | {conversation_id: string; expected_gpt_turn_id?: string; control_loop_id?: string; binding_epoch?: number}): ExpectedControlTurn | null {
  const query = typeof input === 'string' ? {conversation_id: input} : input;
  const state = readState();
  const turns = state.expected_turns.filter(turn => turn.conversation_id === query.conversation_id && ['PENDING', 'GPT_CONTROL_RECEIVED', 'SUBMITTING_AICC'].includes(turn.state));
  if (query.expected_gpt_turn_id) return turns.find(turn => turn.expected_gpt_turn_id === query.expected_gpt_turn_id && (!query.control_loop_id || turn.control_loop_id === query.control_loop_id) && (!query.binding_epoch || turn.binding_epoch === query.binding_epoch)) ?? null;
  const active = turns.filter(turn => {
    const loop = state.loops.find(candidate => candidate.control_loop_id === turn.control_loop_id);
    return loop?.binding_active === true && loop.binding_epoch === turn.binding_epoch && (!query.control_loop_id || turn.control_loop_id === query.control_loop_id) && (!query.binding_epoch || turn.binding_epoch === query.binding_epoch);
  });
  return active.length === 1 ? active[0] : null;
}
export function readExpectedControlTurns(): ExpectedControlTurn[] { return readState().expected_turns; }

export function controlModePrompt(formalWpId = 'AICC-V2-GPT-CODEX-BRIDGE-001'): string {
  return [`You are operating in AICC V2 GPT Control Mode.`, `Formal WP: ${formalWpId}`, '', 'After every AICC_FEEDBACK_V1, output ONLY one of:', ...CONTROL_CONTRACT_TYPES, '', 'No explanations. No summaries. No conversational filler outside the control contract.', 'Use the existing conversation context and current Formal WP. Do not create unnecessary work.', '', 'For this UAT:', 'Round 1 result → create Round 2', 'Round 2 result → create Round 3', 'Round 3 result → AICC_OWNER_UAT_V1 and STOP'].join('\n');
}

export function buildFeedbackEnvelope(input: FeedbackEnvelopeInput): string {
  const executionResult = requireText(input.execution_result, 'EXECUTION_RESULT_REQUIRED');
  const binding_epoch = input.binding_epoch ?? 1;
  const feedback_id = input.feedback_id ?? stableId('feedback', [input.control_loop_id, String(binding_epoch), input.execution_id, input.result_id, input.result_hash]);
  const canonical_expected_gpt_turn_id = expectedGptTurnId(input.control_loop_id, binding_epoch, feedback_id);
  if (input.expected_gpt_turn_id && input.expected_gpt_turn_id !== canonical_expected_gpt_turn_id) throw new Error('FEEDBACK_CORRELATION_IDENTITY_MISMATCH');
  const expected_gpt_turn_id = canonical_expected_gpt_turn_id;
  const canonical_next_control_contract_id = nextControlContractId(expected_gpt_turn_id);
  if (input.next_control_contract_id && input.next_control_contract_id !== canonical_next_control_contract_id) throw new Error('NEXT_CONTROL_CONTRACT_IDENTITY_MISMATCH');
  const next_control_contract_id = canonical_next_control_contract_id;
  return ['AICC_FEEDBACK_V1', `CONTROL_LOOP_ID: ${requireText(input.control_loop_id, 'CONTROL_LOOP_ID_REQUIRED')}`, `BINDING_EPOCH: ${binding_epoch}`, `EXPECTED_GPT_TURN_ID: ${expected_gpt_turn_id}`, `NEXT_CONTROL_CONTRACT_ID: ${next_control_contract_id}`, `FEEDBACK_ID: ${feedback_id}`, `FORMAL_WP_ID: ${requireText(input.formal_wp_id, 'FORMAL_WP_ID_REQUIRED')}`, `CURRENT_PR_ID: ${input.current_pr_id ?? 'NONE'}`, `TASK_ID: ${input.task_id ?? 'NONE'}`, `INSTRUCTION_ID: ${input.instruction_id ?? 'NONE'}`, `EXECUTION_ID: ${requireText(input.execution_id, 'EXECUTION_ID_REQUIRED')}`, `RUN_ID: ${requireText(input.run_id, 'RUN_ID_REQUIRED')}`, `SOURCE: ${input.source ?? GPT_AUTO_CONTROL_LOOP}`, `RUNTIME: ${input.runtime ?? 'CODEX_CLI'}`, `MODEL: ${input.model ?? 'UNAVAILABLE'}`, `RESULT_ID: ${requireText(input.result_id, 'RESULT_ID_REQUIRED')}`, `RESULT_HASH: ${requireText(input.result_hash, 'RESULT_HASH_REQUIRED')}`, '', 'EXECUTION_RESULT_BEGIN', executionResult, 'EXECUTION_RESULT_END', '', 'CONTROL_INSTRUCTION:', '', 'Return ONLY the next canonical AICC control contract.', '', 'Allowed contracts:', ...CONTROL_CONTRACT_TYPES, '', 'No conversational response is required.'].join('\n');
}

function header(text: string, key: string): string | null {
  return text.match(new RegExp(`(?:^|\\n)[ \\t]*${key}[ \\t]*(?:=|:)[ \\t]*([^\\n]*)`, 'i'))?.[1]?.trim() || null;
}

function firstContractMarker(text: string): ControlContractType | null {
  const firstLine = text.trimStart().split('\n', 1)[0]?.trim();
  return CONTROL_CONTRACT_TYPES.find(marker => firstLine === marker) ?? null;
}

export type ParsedControlContract = {type: ControlContractType; class: ControlContractClass; raw: string; instruction?: ExecutionInstruction; fields: Record<string, string>};

export function classifyControlContract(type: ControlContractType): ControlContractClass {
  if (type === 'AICC_EXECUTION_V1') return 'EXECUTABLE_CONTROL';
  if (type === 'AICC_OWNER_UAT_V1') return 'TERMINAL_OWNER_UAT';
  if (type === 'AICC_WP_COMPLETE_V1') return 'TERMINAL_COMPLETE';
  return 'TERMINAL_BLOCKED';
}

export function parseControlContract(text: string): {ok: true; contract: ParsedControlContract} | {ok: false; code: string; reason: string} {
  const raw = String(text ?? '').replace(/\r\n?/g, '\n').trim();
  const type = firstContractMarker(raw);
  if (!type) return {ok: false, code: 'CONTROL_CONTRACT_INVALID', reason: 'The first non-whitespace content is not a canonical AICC control contract.'};
  const fields: Record<string, string> = {};
  for (const line of raw.split('\n')) { const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*:\s*(.*)$/); if (match) fields[match[1]] = match[2].trim(); }
  if (type === 'AICC_EXECUTION_V1') {
    const instructionMatch = raw.match(/^AICC_EXECUTION_V1\n[\s\S]*\nINSTRUCTION_BEGIN\n[\s\S]*\nINSTRUCTION_END$/);
    if (!instructionMatch) return {ok: false, code: 'CONTROL_CONTRACT_INVALID', reason: 'AICC_EXECUTION_V1 must contain one complete instruction block and no trailing prose.'};
    const required = ['ENTITY_TYPE', 'ENTITY_ID', 'EXECUTION_TYPE', 'REPOSITORY', 'BRANCH', 'SANDBOX'];
    if (required.some(key => !fields[key])) return {ok: false, code: 'CONTROL_CONTRACT_INVALID', reason: `AICC_EXECUTION_V1 is missing ${required.find(key => !fields[key])}.`};
    try { return {ok: true, contract: {type, class: classifyControlContract(type), raw, instruction: parseExecutionV1(raw, 'GPT_AUTO_CONTROL_LOOP' as ExecutionSourceType, undefined, {conversationId: fields.CONVERSATION_ID, messageId: fields.MESSAGE_ID}), fields}}; }
    catch { return {ok: false, code: 'CONTROL_CONTRACT_INVALID', reason: 'AICC_EXECUTION_V1 could not be parsed by the canonical AICC execution parser.'}; }
  }
  return {ok: true, contract: {type, class: classifyControlContract(type), raw, fields}};
}

export function buildFeedbackRecord(input: FeedbackEnvelopeInput & {conversation_id: string}): FeedbackRecord {
  const binding_epoch = input.binding_epoch ?? 1;
  const feedback_id = input.feedback_id ?? stableId('feedback', [input.control_loop_id, String(binding_epoch), input.execution_id, input.result_id, input.result_hash]);
  const canonical_expected_gpt_turn_id = expectedGptTurnId(input.control_loop_id, binding_epoch, feedback_id);
  if (input.expected_gpt_turn_id && input.expected_gpt_turn_id !== canonical_expected_gpt_turn_id) throw new Error('FEEDBACK_CORRELATION_IDENTITY_MISMATCH');
  const expected_gpt_turn_id = canonical_expected_gpt_turn_id;
  const canonical_next_control_contract_id = nextControlContractId(expected_gpt_turn_id);
  if (input.next_control_contract_id && input.next_control_contract_id !== canonical_next_control_contract_id) throw new Error('NEXT_CONTROL_CONTRACT_IDENTITY_MISMATCH');
  const next_control_contract_id = canonical_next_control_contract_id;
  const normalized = {...input, binding_epoch, feedback_id, expected_gpt_turn_id, next_control_contract_id};
  const envelope = buildFeedbackEnvelope(normalized);
  const timestamp = now();
  return {...normalized, feedback_key: feedback_id, lifecycle: 'FEEDBACK_READY', envelope, created_at: timestamp, updated_at: timestamp};
}

export function claimFeedback(input: FeedbackEnvelopeInput & {conversation_id: string}): {ok: boolean; claimGranted: boolean; alreadyClaimed?: boolean; deliveryInProgress?: boolean; record?: FeedbackRecord; code?: string; reason?: string} {
  const state = readState();
  const loop = state.loops.find(item => item.control_loop_id === input.control_loop_id);
  if (!loop) return {ok: false, claimGranted: false, code: 'CONTROL_LOOP_NOT_FOUND', reason: 'The requested control loop is not bound.'};
  if (!loop.binding_active) return {ok: false, claimGranted: false, code: 'CONTROL_LOOP_NOT_BOUND', reason: 'The historical control loop has no active Conversation binding.'};
  if (loop.conversation_id !== input.conversation_id) return {ok: false, claimGranted: false, code: 'CROSS_CONVERSATION_ISOLATION', reason: 'The feedback conversation is not the bound conversation.'};
  if (!loop.enabled) return {ok: false, claimGranted: false, code: 'GPT_AUTO_CONTROL_LOOP_OFF', reason: 'Automatic control loop mode is OFF.'};
  if (input.binding_epoch !== undefined && input.binding_epoch !== loop.binding_epoch) return {ok: false, claimGranted: false, code: 'STALE_BINDING_EPOCH', reason: 'The feedback belongs to an inactive conversation binding epoch.'};
  let candidate: FeedbackRecord;
  try { candidate = buildFeedbackRecord({...input, binding_epoch: loop.binding_epoch}); }
  catch (error) { return {ok: false, claimGranted: false, code: error instanceof Error ? error.message : 'FEEDBACK_CORRELATION_IDENTITY_INVALID', reason: 'The feedback correlation identity does not match the canonical loop authority.'}; }
  const existing = state.feedback.find(item => item.feedback_id === candidate.feedback_id || item.feedback_key === candidate.feedback_key);
  if (existing && (existing.control_loop_id !== candidate.control_loop_id || existing.binding_epoch !== candidate.binding_epoch || existing.expected_gpt_turn_id !== candidate.expected_gpt_turn_id)) return {ok: false, claimGranted: false, code: 'FEEDBACK_ID_COLLISION', reason: 'The feedback identity is already bound to another control loop authority.'};
  if (existing) return {ok: true, claimGranted: false, alreadyClaimed: true, deliveryInProgress: existing.lifecycle !== 'FEEDBACK_CONSUMED', record: existing};
  candidate.lifecycle = 'FEEDBACK_CLAIMED';
  candidate.updated_at = now();
  state.feedback.unshift(candidate);
  loop.status = 'RETURNING_FEEDBACK';
  loop.execution_status = 'COMPLETED';
  loop.feedback_delivery_status = 'RESOLVING_TARGET';
  loop.control_loop_status = 'WAITING_FEEDBACK_DELIVERY';
  loop.last_feedback_state = candidate.lifecycle;
  loop.updated_at = candidate.updated_at;
  writeState(state);
  return {ok: true, claimGranted: true, record: candidate};
}

function feedbackState(control_loop_id: string, feedback_key: string): {state: PersistedState; record: FeedbackRecord; loop?: ControlLoopRecord} {
  const state = readState();
  const record = state.feedback.find(item => item.control_loop_id === control_loop_id && item.feedback_key === feedback_key);
  if (!record) throw new Error('FEEDBACK_NOT_FOUND');
  const loop = state.loops.find(item => item.control_loop_id === control_loop_id);
  if (!loop?.binding_active) throw new Error('CONTROL_LOOP_NOT_BOUND');
  if (record.conversation_id !== loop.conversation_id || record.binding_epoch !== loop.binding_epoch) throw new Error('STALE_FEEDBACK_BINDING');
  return {state, record, loop};
}

function updateFeedbackLoop(loop: ControlLoopRecord | undefined, record: FeedbackRecord, status: AutoLoopStatus): void {
  if (!loop) return;
  loop.status = status;
  loop.last_feedback_state = record.lifecycle;
  loop.feedback_delivery_status = feedbackStatusForLifecycle(record.lifecycle);
  loop.control_loop_status = controlStatusForLegacy(status, loop.feedback_delivery_status);
  loop.updated_at = record.updated_at;
}

export function markFeedbackInserting(control_loop_id: string, feedback_key: string): {record: FeedbackRecord; attemptGranted: boolean} {
  const {state, record, loop} = feedbackState(control_loop_id, feedback_key);
  if (record.submission_claimed_at || ['FEEDBACK_SUBMITTING', 'FEEDBACK_SUBMITTED', 'FEEDBACK_CONSUMED', 'FEEDBACK_DELIVERY_FAILED'].includes(record.lifecycle)) return {record, attemptGranted: false};
  const attempts = record.delivery_attempts ?? 0;
  if (attempts >= 1) return {record, attemptGranted: false};
  record.delivery_attempts = attempts + 1;
  record.lifecycle = 'FEEDBACK_INSERTING';
  record.failure_reason = undefined;
  record.updated_at = now();
  updateFeedbackLoop(loop, record, 'RETURNING_FEEDBACK');
  writeState(state);
  return {record, attemptGranted: true};
}

export function markFeedbackInserted(control_loop_id: string, feedback_key: string): FeedbackRecord {
  const {state, record, loop} = feedbackState(control_loop_id, feedback_key);
  if (record.submission_claimed_at || ['FEEDBACK_SUBMITTING', 'FEEDBACK_SUBMITTED', 'FEEDBACK_CONSUMED'].includes(record.lifecycle)) return record;
  if (record.lifecycle !== 'FEEDBACK_INSERTING') throw new Error('FEEDBACK_INSERTION_NOT_CLAIMED');
  record.lifecycle = 'FEEDBACK_INSERTED';
  record.updated_at = now();
  updateFeedbackLoop(loop, record, 'FEEDBACK_INSERTED');
  writeState(state);
  return record;
}

export function markFeedbackSubmitting(control_loop_id: string, feedback_key: string): {record: FeedbackRecord; sendGranted: boolean} {
  const {state, record, loop} = feedbackState(control_loop_id, feedback_key);
  if (record.submission_claimed_at || ['FEEDBACK_SUBMITTING', 'FEEDBACK_SUBMITTED', 'FEEDBACK_CONSUMED'].includes(record.lifecycle)) return {record, sendGranted: false};
  if (record.lifecycle !== 'FEEDBACK_INSERTED') throw new Error('FEEDBACK_INSERTION_NOT_VERIFIED');
  record.lifecycle = 'FEEDBACK_SUBMITTING';
  record.submission_claimed_at = now();
  record.updated_at = record.submission_claimed_at;
  updateFeedbackLoop(loop, record, 'FEEDBACK_SUBMITTING');
  writeState(state);
  return {record, sendGranted: true};
}

export function markFeedbackSubmitted(control_loop_id: string, feedback_key: string): FeedbackRecord {
  const {state, record, loop} = feedbackState(control_loop_id, feedback_key);
  if (['FEEDBACK_SUBMITTED', 'FEEDBACK_CONSUMED'].includes(record.lifecycle)) return record;
  if (!record.submission_claimed_at) throw new Error('FEEDBACK_SUBMISSION_NOT_CLAIMED');
  record.lifecycle = 'FEEDBACK_SUBMITTED';
  record.submitted_at = now();
  record.updated_at = record.submitted_at;
  record.failure_reason = undefined;
  updateFeedbackLoop(loop, record, 'FEEDBACK_SUBMITTED');
  writeState(state);
  return record;
}

export function failFeedbackDelivery(control_loop_id: string, feedback_key: string, reason: string): FeedbackRecord {
  const {state, record, loop} = feedbackState(control_loop_id, feedback_key);
  if (['FEEDBACK_SUBMITTED', 'FEEDBACK_CONSUMED'].includes(record.lifecycle)) return record;
  record.lifecycle = 'FEEDBACK_DELIVERY_FAILED';
  record.failure_reason = requireText(reason, 'FEEDBACK_FAILURE_REASON_REQUIRED');
  record.updated_at = now();
  updateFeedbackLoop(loop, record, 'FEEDBACK_DELIVERY_FAILED');
  if (loop) loop.control_loop_status = 'PAUSED';
  writeState(state);
  return record;
}

export function retryFeedbackDelivery(control_loop_id: string, feedback_key: string): {record: FeedbackRecord; retryGranted: boolean} {
  const state = readState();
  const record = state.feedback.find(item => item.control_loop_id === control_loop_id && item.feedback_key === feedback_key);
  const loop = state.loops.find(item => item.control_loop_id === control_loop_id);
  if (!record || !loop) throw new Error('FEEDBACK_NOT_FOUND');
  if (record.conversation_id !== loop.conversation_id || record.binding_epoch !== loop.binding_epoch) throw new Error('STALE_FEEDBACK_BINDING');
  if (record.lifecycle !== 'FEEDBACK_DELIVERY_FAILED' || (loop.delivery_retry_attempts ?? 0) >= 1) return {record, retryGranted: false};
  loop.delivery_retry_attempts = (loop.delivery_retry_attempts ?? 0) + 1;
  record.delivery_attempts = 0;
  record.submission_claimed_at = undefined;
  record.submitted_at = undefined;
  record.failure_reason = undefined;
  record.lifecycle = 'FEEDBACK_CLAIMED';
  record.updated_at = now();
  loop.status = 'RETURNING_FEEDBACK';
  loop.feedback_delivery_status = 'RESOLVING_TARGET';
  loop.control_loop_status = 'WAITING_FEEDBACK_DELIVERY';
  loop.updated_at = record.updated_at;
  writeState(state);
  return {record, retryGranted: true};
}

export function recoverFeedbackCorrelation(control_loop_id: string, expected_gpt_turn_id: string): {ok: boolean; recoveryGranted: boolean; code?: string; loop?: ControlLoopRecord} {
  const state = readState();
  const loop = state.loops.find(item => item.control_loop_id === control_loop_id);
  if (!loop) return {ok: false, recoveryGranted: false, code: 'CONTROL_LOOP_NOT_FOUND'};
  const expected = state.expected_turns.find(turn => turn.control_loop_id === control_loop_id && turn.binding_epoch === loop.binding_epoch && turn.expected_gpt_turn_id === expected_gpt_turn_id && turn.state === 'PENDING');
  if (!expected) return {ok: false, recoveryGranted: false, code: 'EXPECTED_FEEDBACK_TURN_CORRELATION_FAILED', loop};
  if ((loop.correlation_recovery_attempts ?? 0) >= 1) return {ok: false, recoveryGranted: false, code: 'CORRELATION_RECOVERY_EXHAUSTED', loop};
  const feedback = state.feedback.find(record => record.control_loop_id === control_loop_id && record.binding_epoch === loop.binding_epoch && record.feedback_id === expected.feedback_id && record.expected_gpt_turn_id === expected_gpt_turn_id);
  if (!feedback) return {ok: false, recoveryGranted: false, code: 'FEEDBACK_RECORD_NOT_FOUND', loop};
  loop.correlation_recovery_attempts = (loop.correlation_recovery_attempts ?? 0) + 1;
  feedback.lifecycle = 'FEEDBACK_CONSUMED';
  feedback.correlation_recovery_attempts = (feedback.correlation_recovery_attempts ?? 0) + 1;
  feedback.failure_reason = undefined;
  feedback.updated_at = now();
  loop.last_feedback_state = feedback.lifecycle;
  loop.status = 'WAITING_GPT';
  loop.feedback_delivery_status = 'DELIVERED';
  loop.control_loop_status = 'WAITING_NEXT_CONTROL';
  loop.blocker_code = undefined;
  loop.updated_at = now();
  writeState(state);
  return {ok: true, recoveryGranted: true, loop};
}

export function completeFeedback(control_loop_id: string, feedback_key: string, feedback_message_id = `feedback:${feedback_key}`): FeedbackRecord {
  const {state, record, loop} = feedbackState(control_loop_id, feedback_key);
  if (record.lifecycle !== 'FEEDBACK_SUBMITTED' && record.lifecycle !== 'FEEDBACK_CONSUMED') throw new Error('FEEDBACK_SUBMISSION_NOT_CONFIRMED');
  if (record.lifecycle !== 'FEEDBACK_CONSUMED') record.lifecycle = 'FEEDBACK_CONSUMED';
  record.updated_at = now();
  const existing = state.expected_turns.find(turn => turn.feedback_key === feedback_key && turn.control_loop_id === record.control_loop_id && turn.binding_epoch === record.binding_epoch && turn.expected_gpt_turn_id === record.expected_gpt_turn_id);
  if (!existing) {
    const binding_epoch = record.binding_epoch ?? loop?.binding_epoch ?? 1;
    const expected_gpt_turn_id = requireText(record.expected_gpt_turn_id, 'EXPECTED_GPT_TURN_ID_REQUIRED');
    for (const turn of state.expected_turns) {
      if (turn.control_loop_id === record.control_loop_id && turn.binding_epoch === binding_epoch && turn.state === 'PENDING') { turn.state = 'FAILED'; turn.failure_code = 'SUPERSEDED_EXPECTED_TURN'; turn.updated_at = record.updated_at; }
    }
    state.expected_turns.unshift({control_loop_id: record.control_loop_id, binding_epoch, conversation_id: record.conversation_id, feedback_key: record.feedback_key, feedback_id: record.feedback_id, expected_gpt_turn_id, next_control_contract_id: nextControlContractId(expected_gpt_turn_id), feedback_message_id: requireText(feedback_message_id, 'FEEDBACK_MESSAGE_ID_REQUIRED'), result_id: record.result_id, result_hash: record.result_hash, created_at: record.updated_at, updated_at: record.updated_at, state: 'PENDING'});
  }
  updateFeedbackLoop(loop, record, 'WAITING_GPT');
  if (loop) { loop.feedback_delivery_status = 'DELIVERED'; loop.control_loop_status = 'WAITING_NEXT_CONTROL'; }
  writeState(state); return record;
}

export function readFeedback(control_loop_id: string): FeedbackRecord[] { return readState().feedback.filter(item => item.control_loop_id === control_loop_id); }

function updateLoopFromContract(loop: ControlLoopRecord, claim: ControlClaim, contract: ParsedControlContract): void {
  loop.last_control_type = contract.type;
  loop.last_assistant_message_id = claim.assistant_message_id;
  loop.last_control_message_hash = claim.control_message_hash;
  loop.last_response_evidence = claim.response;
  loop.updated_at = now();
  if (contract.type === 'AICC_OWNER_UAT_V1') { loop.status = 'WAITING_OWNER_UAT'; loop.owner_uat_request = claim.response; }
  if (contract.type === 'AICC_WP_COMPLETE_V1') loop.status = 'COMPLETE';
  if (contract.type === 'AICC_BLOCKED_V1') { loop.status = 'BLOCKED'; loop.blocker_code = header(claim.response, 'BLOCKER_CODE') ?? 'AICC_BLOCKED_V1'; }
}

export function consumeGptControl(input: {conversation_id: string; assistant_message_id: string; response: string; control_loop_id?: string; binding_epoch?: number; feedback_key?: string; expected_gpt_turn_id?: string}, submit: (instruction: ExecutionInstruction, control_loop_id: string) => InboxItem, launch: (inboxId: string) => InboxItem): {ok: boolean; claimGranted: boolean; duplicate?: boolean; contract?: ParsedControlContract; claim?: ControlClaim; item?: InboxItem; expected_turn?: ExpectedControlTurn; code?: string; reason?: string} {
  const state = readState();
  const control_message_hash = hashControlMessage(input.response);
  const duplicate = state.controls.find(item => item.conversation_id === input.conversation_id && (item.assistant_message_id === input.assistant_message_id || item.control_message_hash === control_message_hash));
  if (duplicate) {
    const parsedDuplicate = parseControlContract(duplicate.response);
    return {ok: true, claimGranted: false, duplicate: true, claim: duplicate, contract: parsedDuplicate.ok ? parsedDuplicate.contract : undefined};
  }
  const activeLoop = state.loops.find(item => item.conversation_id === input.conversation_id && item.binding_active && item.enabled);
  if (activeLoop && ['WAITING_OWNER_UAT', 'BLOCKED', 'COMPLETE', 'PAUSED'].includes(activeLoop.status)) return {ok: false, claimGranted: false, code: 'AUTO_LOOP_STOPPED', reason: `Automatic progression is stopped in ${activeLoop.status}.`};
  const consumedFeedbackTurn = input.feedback_key ? state.controls.find(item => item.conversation_id === input.conversation_id && item.feedback_key === input.feedback_key && (!input.control_loop_id || item.control_loop_id === input.control_loop_id) && (!input.binding_epoch || item.binding_epoch === input.binding_epoch) && (!input.expected_gpt_turn_id || item.expected_gpt_turn_id === input.expected_gpt_turn_id)) : undefined;
  if (consumedFeedbackTurn) return {ok: true, claimGranted: false, duplicate: true, claim: consumedFeedbackTurn};
  if (input.control_loop_id) { const suppliedLoop = state.loops.find(item => item.control_loop_id === input.control_loop_id); if (suppliedLoop && suppliedLoop.conversation_id !== input.conversation_id) return {ok: false, claimGranted: false, code: 'CROSS_CONVERSATION_ISOLATION', reason: 'The Assistant response belongs to another conversation.'}; }
  const candidates = state.expected_turns.filter(turn => turn.conversation_id === input.conversation_id && ['PENDING', 'GPT_CONTROL_RECEIVED', 'SUBMITTING_AICC'].includes(turn.state));
  const expectedTurn = input.expected_gpt_turn_id ? candidates.find(turn => turn.expected_gpt_turn_id === input.expected_gpt_turn_id && (!input.control_loop_id || turn.control_loop_id === input.control_loop_id) && (!input.binding_epoch || turn.binding_epoch === input.binding_epoch)) : undefined;
  if (!expectedTurn) {
    if (activeLoop) {
      const currentExpected = candidates.find(turn => turn.control_loop_id === activeLoop.control_loop_id && turn.binding_epoch === activeLoop.binding_epoch);
      const currentFeedback = currentExpected ? state.feedback.find(record => record.feedback_id === currentExpected.feedback_id && record.control_loop_id === activeLoop.control_loop_id && record.binding_epoch === activeLoop.binding_epoch) : undefined;
      if (currentFeedback) {
        currentFeedback.lifecycle = 'FEEDBACK_CORRELATION_FAILED';
        currentFeedback.failure_reason = input.expected_gpt_turn_id ? 'EXPECTED_FEEDBACK_TURN_CORRELATION_FAILED' : 'EXPECTED_FEEDBACK_TURN_REQUIRED';
        currentFeedback.updated_at = now();
        activeLoop.last_feedback_state = currentFeedback.lifecycle;
      }
      activeLoop.status = 'PAUSED'; activeLoop.feedback_delivery_status = 'CORRELATION_FAILED'; activeLoop.control_loop_status = 'PAUSED'; activeLoop.blocker_code = input.expected_gpt_turn_id ? 'EXPECTED_FEEDBACK_TURN_CORRELATION_FAILED' : 'EXPECTED_FEEDBACK_TURN_REQUIRED'; activeLoop.updated_at = now(); writeState(state);
    }
    return {ok: false, claimGranted: false, code: input.expected_gpt_turn_id ? 'EXPECTED_FEEDBACK_TURN_CORRELATION_FAILED' : 'EXPECTED_FEEDBACK_TURN_REQUIRED', reason: 'No exact pending canonical feedback turn exists for this conversation and binding.'};
  }
  const loop = state.loops.find(item => item.control_loop_id === expectedTurn.control_loop_id && item.conversation_id === expectedTurn.conversation_id && item.binding_epoch === expectedTurn.binding_epoch);
  if (!loop) { expectedTurn.state = 'FAILED'; expectedTurn.failure_code = 'EXPECTED_CONTROL_LOOP_UNAVAILABLE'; expectedTurn.updated_at = now(); writeState(state); return {ok: false, claimGranted: false, expected_turn: expectedTurn, code: 'EXPECTED_CONTROL_LOOP_UNAVAILABLE', reason: 'The expected control turn no longer resolves to its canonical loop.'}; }
  if (!loop.binding_active) return {ok: false, claimGranted: false, expected_turn: expectedTurn, code: 'CONTROL_LOOP_NOT_BOUND', reason: 'Automatic control is disabled until the Conversation is explicitly locked again.'};
  if (activeLoop?.control_loop_id !== loop.control_loop_id) { expectedTurn.state = 'FAILED'; expectedTurn.failure_code = 'CANONICAL_LOOP_INACTIVE'; expectedTurn.updated_at = now(); loop.status = 'PAUSED'; loop.blocker_code = expectedTurn.failure_code; loop.updated_at = expectedTurn.updated_at; writeState(state); return {ok: false, claimGranted: false, expected_turn: expectedTurn, code: 'CANONICAL_LOOP_INACTIVE', reason: 'The expected turn loop is not the active canonical loop for this conversation.'}; }
  if (!loop.enabled) return {ok: false, claimGranted: false, code: 'GPT_AUTO_CONTROL_LOOP_OFF', reason: 'Automatic control loop mode is OFF.'};
  if (['WAITING_OWNER_UAT', 'BLOCKED', 'COMPLETE', 'PAUSED'].includes(loop.status)) return {ok: false, claimGranted: false, code: 'AUTO_LOOP_STOPPED', reason: `Automatic progression is stopped in ${loop.status}.`};
  if (loop.binding_assistant_message_ids.includes(input.assistant_message_id) || loop.binding_control_message_hashes.includes(control_message_hash)) return {ok: false, claimGranted: false, code: 'STALE_PRE_BIND_CONTROL', reason: 'The Assistant response predates the current explicit conversation binding.'};
  const feedback = state.feedback.find(item => item.feedback_key === expectedTurn.feedback_key && item.control_loop_id === expectedTurn.control_loop_id && item.conversation_id === expectedTurn.conversation_id && item.binding_epoch === expectedTurn.binding_epoch && item.lifecycle === 'FEEDBACK_CONSUMED');
  if (!feedback) { expectedTurn.state = 'FAILED'; expectedTurn.failure_code = 'EXPECTED_FEEDBACK_TURN_REQUIRED'; expectedTurn.updated_at = now(); loop.status = 'PAUSED'; loop.blocker_code = expectedTurn.failure_code; loop.updated_at = expectedTurn.updated_at; writeState(state); return {ok: false, claimGranted: false, expected_turn: expectedTurn, code: 'EXPECTED_FEEDBACK_TURN_REQUIRED', reason: 'The control response is not linked to a consumed feedback turn in the current binding epoch.'}; }
  const feedbackControl = state.controls.find(item => item.control_loop_id === expectedTurn.control_loop_id && item.binding_epoch === expectedTurn.binding_epoch && item.feedback_key === expectedTurn.feedback_key);
  if (feedbackControl) return {ok: true, claimGranted: false, duplicate: true, claim: feedbackControl};
  const existing = state.controls.find(item => item.control_loop_id === expectedTurn.control_loop_id && item.conversation_id === expectedTurn.conversation_id && item.binding_epoch === expectedTurn.binding_epoch && item.control_message_hash === control_message_hash);
  if (existing) return {ok: true, claimGranted: false, duplicate: true, claim: existing};
  const parsed = parseControlContract(input.response);
  const claim: ControlClaim = {control_loop_id: expectedTurn.control_loop_id, conversation_id: expectedTurn.conversation_id, binding_epoch: expectedTurn.binding_epoch, feedback_key: expectedTurn.feedback_key, expected_gpt_turn_id: expectedTurn.expected_gpt_turn_id, next_control_contract_id: expectedTurn.next_control_contract_id, assistant_message_id: input.assistant_message_id, control_message_hash, contract_type: parsed.ok ? parsed.contract.type : 'AICC_BLOCKED_V1', contract_class: parsed.ok ? parsed.contract.class : 'TERMINAL_BLOCKED', lifecycle: parsed.ok ? 'GPT_CONTROL_DETECTED' : 'CONTROL_CONTRACT_INVALID', response: input.response, created_at: now(), updated_at: now(), invalid_code: parsed.ok ? undefined : parsed.code};
  state.controls.unshift(claim);
  expectedTurn.state = parsed.ok ? 'GPT_CONTROL_RECEIVED' : 'FAILED'; expectedTurn.assistant_message_id = input.assistant_message_id; expectedTurn.control_message_hash = control_message_hash; expectedTurn.updated_at = claim.updated_at;
  if (!parsed.ok) { expectedTurn.failure_code = parsed.code; loop.status = 'PAUSED'; loop.blocker_code = parsed.code; loop.last_response_evidence = input.response; loop.updated_at = claim.updated_at; writeState(state); return {ok: false, claimGranted: true, claim, expected_turn: expectedTurn, code: parsed.code, reason: parsed.reason}; }
  claim.lifecycle = 'CONTROL_CLAIMED'; loop.status = 'GPT_CONTROL_RECEIVED'; updateLoopFromContract(loop, claim, parsed.contract);
  expectedTurn.instruction_id = parsed.contract.instruction?.instructionId ?? null;
  if (parsed.contract.class !== 'EXECUTABLE_CONTROL') { claim.lifecycle = 'CONTROL_CONSUMED'; claim.updated_at = now(); expectedTurn.state = 'CONSUMED'; expectedTurn.updated_at = claim.updated_at; loop.control_loop_status = parsed.contract.type === 'AICC_OWNER_UAT_V1' ? 'WAITING_OWNER_UAT' : parsed.contract.type === 'AICC_WP_COMPLETE_V1' ? 'COMPLETE' : 'BLOCKED'; writeState(state); return {ok: true, claimGranted: true, contract: parsed.contract, claim, expected_turn: expectedTurn}; }
  const executions = state.controls.filter(item => item.control_loop_id === loop.control_loop_id && item.binding_epoch === loop.binding_epoch && item.contract_type === 'AICC_EXECUTION_V1' && ['SUBMITTED_TO_AICC', 'EXECUTION_STARTED', 'CONTROL_CONSUMED'].includes(item.lifecycle));
  if (executions.length >= 3) { loop.status = 'PAUSED'; loop.blocker_code = 'MAX_EXECUTION_COUNT'; claim.lifecycle = 'CONTROL_CONTRACT_INVALID'; claim.invalid_code = 'MAX_EXECUTION_COUNT'; claim.updated_at = now(); loop.updated_at = claim.updated_at; expectedTurn.state = 'FAILED'; expectedTurn.failure_code = 'MAX_EXECUTION_COUNT'; expectedTurn.updated_at = claim.updated_at; writeState(state); return {ok: false, claimGranted: true, contract: parsed.contract, claim, expected_turn: expectedTurn, code: 'MAX_EXECUTION_COUNT', reason: 'Automatic control loop execution limit reached.'}; }
  expectedTurn.state = 'SUBMITTING_AICC'; expectedTurn.updated_at = now(); loop.status = 'SUBMITTING_AICC'; loop.execution_status = 'SUBMITTING'; loop.control_loop_status = 'CONTINUING'; loop.updated_at = expectedTurn.updated_at; writeState(state);
  let item: InboxItem; let launched: InboxItem;
  try { item = submit(parsed.contract.instruction!, loop.control_loop_id); launched = item.state === 'READY' ? launch(item.id) : item; }
  catch (error) { const failedState = readState(); const failedTurn = failedState.expected_turns.find(turn => turn.feedback_key === expectedTurn.feedback_key); const failedLoop = failedState.loops.find(item => item.control_loop_id === loop.control_loop_id); if (failedTurn) { failedTurn.state = 'FAILED'; failedTurn.failure_code = error instanceof Error ? error.message : 'CONTROL_SUBMIT_FAILED'; failedTurn.updated_at = now(); } if (failedLoop) { failedLoop.status = 'PAUSED'; failedLoop.blocker_code = failedTurn?.failure_code; failedLoop.updated_at = now(); } writeState(failedState); return {ok: false, claimGranted: true, claim, expected_turn: failedTurn, code: failedTurn?.failure_code || 'CONTROL_SUBMIT_FAILED', reason: 'The canonical control could not be submitted to AICC.'}; }
  claim.lifecycle = 'SUBMITTED_TO_AICC'; claim.inbox_id = item.id; claim.instruction_id = item.instruction?.instructionId; claim.updated_at = now();
  claim.lifecycle = launched.runId ? 'EXECUTION_STARTED' : 'SUBMITTED_TO_AICC'; claim.execution_id = launched.executionId; claim.run_id = launched.runId;
  loop.status = launched.runId ? 'RUNNING_LUNA' : 'GPT_CONTROL_RECEIVED'; loop.execution_status = launched.runId ? 'RUNNING' : 'STARTING'; loop.control_loop_status = 'RUNNING'; loop.run_id = launched.runId; loop.execution_id = launched.executionId; loop.executor = 'LUNA'; loop.runtime = 'CODEX_CLI'; loop.model = launched.model ?? loop.model; loop.reasoning_effort = launched.reasoning_effort ?? loop.reasoning_effort; loop.model_source = launched.model_source ?? 'CODEX_DEFAULT'; loop.current_task = parsed.contract.instruction?.declaredTaskId ?? parsed.contract.instruction?.instructionId; loop.updated_at = claim.updated_at;
  claim.lifecycle = 'CONTROL_CONSUMED'; claim.updated_at = now(); expectedTurn.state = 'CONSUMED'; expectedTurn.updated_at = claim.updated_at;
  writeState(state);
  return {ok: true, claimGranted: true, contract: parsed.contract, claim, item: launched, expected_turn: expectedTurn};
}

export function recordExecutionResult(control_loop_id: string, report: BridgeReport): FeedbackRecord | null {
  const loop = readControlLoop(control_loop_id);
  const result = report.canonicalResult;
  if (!loop || !result || !report.runId || !result.resultId || !result.resultHash) return null;
  return buildFeedbackRecord({control_loop_id, formal_wp_id: loop.formal_wp_id, binding_epoch: loop.binding_epoch, current_pr_id: report.entityType === 'PULL_REQUEST' ? report.entityId : null, task_id: report.inboxId, instruction_id: result.instructionId, execution_id: result.executionId, run_id: report.runId, source: GPT_AUTO_CONTROL_LOOP, runtime: 'CODEX_CLI', model: report.model, result_id: result.resultId, result_hash: result.resultHash, execution_result: result.rawResult, conversation_id: loop.conversation_id});
}

export type CanonicalControlLoopReadModel = {
  control_loop_id: string;
  conversation_id: string;
  binding_epoch: number;
  execution_status: ExecutionStatus;
  feedback_delivery_status: FeedbackDeliveryStatus;
  control_loop_status: CanonicalControlLoopStatus;
  expected_gpt_turn_id?: string;
  feedback_id?: string;
  result_id?: string;
  result_hash?: string;
  run_id?: string;
  execution_id?: string;
  blocker_code?: string;
};

export function canonicalControlLoopReadModel(loop: ControlLoopRecord | null): CanonicalControlLoopReadModel | null {
  if (!loop) return null;
  const state = readState();
  const expected = state.expected_turns.find(turn => turn.control_loop_id === loop.control_loop_id && turn.binding_epoch === loop.binding_epoch && ['PENDING', 'GPT_CONTROL_RECEIVED', 'SUBMITTING_AICC'].includes(turn.state));
  const feedback = expected ? state.feedback.find(record => record.feedback_id === expected.feedback_id) : state.feedback.find(record => record.control_loop_id === loop.control_loop_id && record.binding_epoch === loop.binding_epoch);
  return {control_loop_id: loop.control_loop_id, conversation_id: loop.conversation_id, binding_epoch: loop.binding_epoch, execution_status: loop.execution_status, feedback_delivery_status: loop.feedback_delivery_status, control_loop_status: loop.control_loop_status, expected_gpt_turn_id: expected?.expected_gpt_turn_id ?? feedback?.expected_gpt_turn_id, feedback_id: feedback?.feedback_id, result_id: feedback?.result_id, result_hash: feedback?.result_hash, run_id: loop.run_id, execution_id: loop.execution_id, blocker_code: loop.blocker_code};
}

export type ControlLoopFeedbackProjection = {state: 'INFO' | 'RUNNING' | 'SUCCESS' | 'BLOCKED' | 'ERROR'; title: string; message: string; code?: string; next?: string; copyable?: boolean};

export function projectControlLoopFeedback(loop: ControlLoopRecord | null): ControlLoopFeedbackProjection {
  if (!loop || !loop.binding_active) return {state: 'INFO', title: '自动循环未绑定', message: '等待绑定 canonical GPT Conversation。', code: 'AUTO_LOOP_NOT_BOUND'};
  if (loop.feedback_delivery_status === 'CORRELATION_FAILED') return {state: 'ERROR', title: '自动循环回传失败', message: 'EXPECTED_FEEDBACK_TURN_CORRELATION_FAILED', code: 'EXPECTED_FEEDBACK_TURN_CORRELATION_FAILED', next: '检查 exact expected GPT turn 与 Binding Epoch。'};
  if (loop.feedback_delivery_status === 'DELIVERY_FAILED') return {state: 'ERROR', title: '自动循环回传失败', message: loop.blocker_code ?? 'FEEDBACK_DELIVERY_FAILED', code: 'FEEDBACK_DELIVERY_FAILED'};
  if (loop.control_loop_status === 'WAITING_OWNER_UAT') return {state: 'INFO', title: '等待 Owner UAT', message: '自动阶段已完成，控制循环已按协议停止。', code: 'WAITING_OWNER_UAT'};
  if (loop.control_loop_status === 'COMPLETE') return {state: 'SUCCESS', title: '自动循环完成', message: loop.formal_wp_id, code: 'CONTROL_LOOP_COMPLETE'};
  if (loop.status === 'STOPPED_BY_OWNER') return {state: 'BLOCKED', title: '自动循环已停止', message: 'STOPPED_BY_OWNER', code: 'STOPPED_BY_OWNER'};
  if (loop.control_loop_status === 'BLOCKED' || loop.control_loop_status === 'PAUSED') return {state: 'BLOCKED', title: '自动循环已暂停', message: loop.blocker_code ?? 'AUTO_LOOP_PAUSED', code: loop.blocker_code ?? 'AUTO_LOOP_PAUSED'};
  if (loop.feedback_delivery_status === 'DELIVERING' || loop.feedback_delivery_status === 'RESOLVING_TARGET') return {state: 'RUNNING', title: '正在回传执行结果', message: '等待 GPT 接收 feedback。', code: 'FEEDBACK_DELIVERING'};
  if (loop.control_loop_status === 'WAITING_NEXT_CONTROL') return {state: 'RUNNING', title: '正在生成下一步控制指令', message: '等待 canonical control contract。', code: 'WAITING_NEXT_CONTROL'};
  return {state: 'RUNNING', title: '自动循环执行中', message: loop.current_task ?? loop.formal_wp_id, code: 'AUTO_LOOP_RUNNING'};
}

export function projectAutoLoopStatus(loop: ControlLoopRecord | null): {label: string; state: AutoLoopStatus; control_loop_id?: string; conversation_id?: string; task?: string; run_id?: string; runtime_model?: string; last_feedback_state?: FeedbackLifecycle; execution_status?: ExecutionStatus; feedback_delivery_status?: FeedbackDeliveryStatus; control_loop_status?: CanonicalControlLoopStatus; expected_gpt_turn_id?: string} {
  if (!loop) return {label: 'AUTO LOOP · OFF', state: 'OFF'};
  if (!loop.binding_active) return {label: 'AUTO LOOP · NOT BOUND', state: 'OFF', control_loop_id: loop.control_loop_id, conversation_id: loop.conversation_id, task: loop.current_task, run_id: loop.run_id, runtime_model: [loop.runtime, loop.model, loop.reasoning_effort].filter(Boolean).join(' · ') || undefined, last_feedback_state: loop.last_feedback_state, execution_status: loop.execution_status, feedback_delivery_status: loop.feedback_delivery_status, control_loop_status: loop.control_loop_status};
  const labels: Record<AutoLoopStatus, string> = {OFF: 'AUTO LOOP · OFF', WAITING_GPT: 'AUTO LOOP · WAITING GPT', GPT_CONTROL_RECEIVED: 'AUTO LOOP · GPT CONTROL RECEIVED', SUBMITTING_AICC: 'AUTO LOOP · SUBMITTING AICC', RUNNING_LUNA: 'AUTO LOOP · RUNNING LUNA', RESULT_READY: 'AUTO LOOP · RESULT READY', RETURNING_FEEDBACK: 'AUTO LOOP · RETURNING FEEDBACK', FEEDBACK_INSERTED: 'AUTO LOOP · FEEDBACK INSERTED', FEEDBACK_SUBMITTING: 'AUTO LOOP · FEEDBACK SUBMITTING', FEEDBACK_SUBMITTED: 'AUTO LOOP · FEEDBACK SUBMITTED', FEEDBACK_DELIVERY_FAILED: 'AUTO LOOP · FEEDBACK DELIVERY FAILED', WAITING_OWNER_UAT: 'AUTO LOOP · WAITING OWNER UAT', BLOCKED: 'AUTO LOOP · BLOCKED', COMPLETE: 'AUTO LOOP · COMPLETE', PAUSED: 'AUTO LOOP · PAUSED', STOPPED_BY_OWNER: 'AUTO LOOP · STOPPED BY OWNER'};
  const readModel = canonicalControlLoopReadModel(loop);
  return {label: labels[loop.status], state: loop.status, control_loop_id: loop.control_loop_id, conversation_id: loop.conversation_id, task: loop.current_task, run_id: loop.run_id, runtime_model: [loop.runtime, loop.model, loop.reasoning_effort].filter(Boolean).join(' · ') || undefined, last_feedback_state: loop.last_feedback_state, execution_status: loop.execution_status, feedback_delivery_status: loop.feedback_delivery_status, control_loop_status: loop.control_loop_status, expected_gpt_turn_id: readModel?.expected_gpt_turn_id};
}

export const GPT_AUTO_CONTROL_LOOP_CONTRACT = Object.freeze({mode: GPT_AUTO_CONTROL_LOOP, decisionAuthority: 0, executor: 'LUNA', source: GPT_AUTO_CONTROL_LOOP, maxExecutionCount: 3});
