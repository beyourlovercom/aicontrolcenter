const AICC_ORIGIN = 'http://127.0.0.1:1420';
const CORRELATION_KEY = 'aicc-gpt-bridge-adapter-correlation-v1';
const PENDING_SUBMISSION_KEY = 'aicc-gpt-bridge-pending-submission-v1';
function scopedStorageKey(base, scopeId) { const exact = String(scopeId || '').trim(); if (!exact) throw failure('BRIDGE_SCOPE_REQUIRED', '缺少 Bridge conversation scope。', '刷新目标 ChatGPT conversation 后重试。'); return `${base}:${exact}`; }
const AUTO_LOOP_STATUS_PATH = '/api/gpt-bridge/auto-loop';
const LOCAL_SYNC_KEY = 'aicc-bug-registry-local-sync-v1';

function failure(code, reason, nextAction) {
  return { code, state: 'ERROR', reason, nextAction };
}

async function readJson(response) {
  try { return await response.json(); } catch { return {}; }
}

async function request(path, init) {
  let response;
  try { response = await fetch(`${AICC_ORIGIN}${path}`, init); }
  catch { throw failure('AICC_UNAVAILABLE', '无法连接 AICC 本地服务。', '确认 127.0.0.1:1420 可用后重试。'); }
  const body = await readJson(response);
  if (!response.ok) {
    const serverError = typeof body.error === 'string' ? body.error : body.error?.code || body.code;
    throw failure(serverError || `AICC_HTTP_${response.status}`, `AICC 拒绝请求：HTTP ${response.status} · ${serverError || 'UNKNOWN_ERROR'}`, '根据错误原因修正请求后重试。');
  }
  return body;
}

async function autoLoopStatus(message = {}) {
  const query = new URLSearchParams();
  if (message.control_loop_id) query.set('controlLoopId', message.control_loop_id);
  if (message.conversation_id) query.set('conversationId', message.conversation_id);
  return request(`${AUTO_LOOP_STATUS_PATH}/status${query.toString() ? `?${query}` : ''}`);
}

async function autoLoopRequest(operation, payload) {
  return request(`${AUTO_LOOP_STATUS_PATH}/${operation}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

async function autoLoopBind(message) {
  const conversation_id = String(message.conversation_id || '').trim();
  if (!conversation_id || !String(message.formal_wp_id || '').trim()) throw failure('CONTROL_LOOP_BINDING_REQUIRED', '缺少 GPT 会话或 Formal WP 绑定。', '返回目标对话后重新锁定。');
  return autoLoopRequest('bind', { formal_wp_id: message.formal_wp_id, conversation_id, visible_assistant_controls: Array.isArray(message.visible_assistant_controls) ? message.visible_assistant_controls : [] });
}

async function autoLoopUnbind(message) {
  if (!String(message.control_loop_id || '').trim()) throw failure('CONTROL_LOOP_UNBIND_REQUIRED', '缺少 Control Loop 绑定。', '刷新当前对话后重试。');
  return autoLoopRequest('unbind', { control_loop_id: message.control_loop_id });
}

async function autoLoopMode(message) {
  if (!String(message.control_loop_id || '').trim() || typeof message.enabled !== 'boolean') throw failure('CONTROL_LOOP_MODE_REQUIRED', '缺少自动循环模式参数。', '确认当前对话已锁定后重试。');
  return autoLoopRequest('mode', { control_loop_id: message.control_loop_id, enabled: message.enabled });
}

async function autoLoopFeedback(message) {
  const required = ['control_loop_id', 'formal_wp_id', 'conversation_id', 'execution_id', 'run_id', 'result_id', 'result_hash', 'execution_result'];
  if (required.some(key => typeof message[key] !== 'string' || !message[key].trim())) throw failure('FEEDBACK_IDENTITY_REQUIRED', 'Canonical feedback identity 不完整。', '等待完整的 Codex canonical result。');
  return autoLoopRequest('feedback/claim', {
    control_loop_id: message.control_loop_id,
    formal_wp_id: message.formal_wp_id,
    conversation_id: message.conversation_id,
    binding_epoch: message.binding_epoch,
    execution_id: message.execution_id,
    run_id: message.run_id,
    result_id: message.result_id,
    result_hash: message.result_hash,
    execution_result: message.execution_result,
    source: 'GPT_AUTO_CONTROL_LOOP',
    runtime: 'CODEX_CLI',
    model: message.model
  });
}

async function autoLoopFeedbackState(message) {
  if (!String(message.control_loop_id || '').trim() || !String(message.feedback_key || '').trim()) throw failure('FEEDBACK_KEY_REQUIRED', '缺少 canonical Feedback ID。', '刷新自动循环状态后重试。');
  return autoLoopRequest(`feedback/${message.operation}`, { control_loop_id: message.control_loop_id, feedback_key: message.feedback_key, ...(message.reason ? { reason: message.reason } : {}), ...(message.feedback_message_id ? { feedback_message_id: message.feedback_message_id } : {}), ...(message.conversation_id ? { conversation_id: message.conversation_id } : {}) });
}

async function autoLoopControl(message) {
  const evidence = { conversation_id: message.conversation_id, assistant_message_id: message.assistant_message_id, response: message.response, expected_gpt_turn_id: message.expected_gpt_turn_id };
  if (!evidence.conversation_id || !evidence.assistant_message_id || !evidence.response || !evidence.expected_gpt_turn_id) throw failure('EXPECTED_FEEDBACK_TURN_REQUIRED', '缺少 exact expected GPT turn evidence。', '等待 canonical feedback turn 后重试。');
  return autoLoopRequest('control/consume', evidence);
}

async function autoLoopCorrelationRecover(message) {
  if (!String(message.control_loop_id || '').trim() || !String(message.expected_gpt_turn_id || '').trim()) throw failure('CORRELATION_RECOVERY_IDENTITY_REQUIRED', '缺少 exact correlation recovery identity。', '保留当前 feedback 并重试。');
  return autoLoopRequest('feedback/correlation-recover', { control_loop_id: message.control_loop_id, expected_gpt_turn_id: message.expected_gpt_turn_id });
}

async function sendInstruction(message) {
  const text = typeof message.text === 'string' ? message.text : '';
  if (!text.trim()) throw { ...failure('INSTRUCTION_TEXT_REQUIRED', '没有找到可发送的任务内容。', '在 ChatGPT 编辑框中输入任务后重试。'), state: 'BLOCKED' };
  const sourceType = ['GPT_BLOCK', 'CLIPBOARD_DIRECT'].includes(message.sourceType) ? message.sourceType : 'WEB_BRIDGE';
  const ownerDirectExecution = sourceType === 'CLIPBOARD_DIRECT';
  const body = await request('/api/gpt-bridge/inbox', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload: text, sourceType, sourceReference: message.sourceReference, originContext: message.originContext, submissionId: message.submissionId, createCanonicalTask: true, executionProvider: message.executionProvider, runnerId: message.runnerId })
  });
  const item = body.item;
  if (!item || !item.id) throw failure('INBOX_RESPONSE_INVALID', 'AICC 返回了无法识别的 Inbox 结果。', '检查本地服务日志后重试。');
  const correlation = { submissionId: item.submissionId || item.id, inboxId: item.id, instructionId: item.instruction?.instructionId, taskId: item.taskId, projectId: item.projectId, repositoryIdentity: item.repositoryIdentity, sourceType, ownerDirectExecution, sourceReference: message.sourceReference, originContext: message.originContext, tabId: message.tabId, sentAt: new Date().toISOString(), ...(item.executionId ? { executionId: item.executionId } : {}), ...(item.runId ? { runId: item.runId } : {}) };
  const correlationKey = scopedStorageKey(CORRELATION_KEY, message.bridgeScopeId);
  const pendingKey = scopedStorageKey(PENDING_SUBMISSION_KEY, message.bridgeScopeId);
  const pending = (await chrome.storage.local.get(pendingKey))[pendingKey];
  const acknowledged = pending?.submission_id === message.submissionId ? { ...pending, ack_state: 'ACKNOWLEDGED', inbox_id: item.id, task_id: item.taskId, project_id: item.projectId, repository_identity: item.repositoryIdentity, execution_id: item.executionId, run_id: item.runId, updated_at: new Date().toISOString() } : pending;
    await chrome.storage.local.set({ [correlationKey]: correlation, ...(acknowledged ? { [pendingKey]: acknowledged } : {}) });
  return { item, correlation };
}

function exactPendingInbox(pending, items) {
  const exact = predicate => items.find(predicate) || null;
  if (pending.inbox_id) { const item = exact(candidate => candidate.id === pending.inbox_id); if (item) return item; }
  if (pending.run_id) { const item = exact(candidate => candidate.runId === pending.run_id); if (item) return item; }
  if (pending.execution_id) { const item = exact(candidate => candidate.executionId === pending.execution_id); if (item) return item; }
  const submission = exact(candidate => candidate.submissionId === pending.submission_id || candidate.id === pending.submission_id);
  if (submission) return submission;
  return null;
}

async function reconcileSubmission(message = {}) {
  const pendingKey = scopedStorageKey(PENDING_SUBMISSION_KEY, message.bridgeScopeId);
  const correlationKey = scopedStorageKey(CORRELATION_KEY, message.bridgeScopeId);
  const stored = await chrome.storage.local.get([pendingKey, correlationKey]);
  const pending = message.pending || stored[pendingKey];
  if (!pending?.submission_id) return { reconciled: false, item: null, correlation: stored[correlationKey] || null };
  const inboxBody = await request('/api/gpt-bridge/inbox');
  const inbox = exactPendingInbox(pending, Array.isArray(inboxBody.items) ? inboxBody.items : []);
  if (!inbox) return { reconciled: false, item: null, correlation: null, pending };
  const correlation = { ...(stored[correlationKey] || {}), submissionId: inbox.submissionId || pending.submission_id, inboxId: inbox.id, instructionId: inbox.instruction?.instructionId || pending.instruction_id, taskId: inbox.taskId, projectId: inbox.projectId, repositoryIdentity: inbox.repositoryIdentity, executionId: inbox.executionId, runId: inbox.runId, sourceType: pending.source, sourceReference: pending.source_reference, originContext: pending.origin_context || (pending.conversation_id ? { conversationId: pending.conversation_id } : undefined), reconciledAt: new Date().toISOString() };
  const acknowledged = { ...pending, ack_state: 'ACKNOWLEDGED', inbox_id: inbox.id, task_id: inbox.taskId, project_id: inbox.projectId, repository_identity: inbox.repositoryIdentity, execution_id: correlation.executionId, run_id: correlation.runId, updated_at: new Date().toISOString() };
  await chrome.storage.local.set({ [correlationKey]: correlation, [pendingKey]: acknowledged });
  return { reconciled: true, item: inbox, inbox, correlation, pending: acknowledged };
}

async function importAndRun(message) {
  return sendInstruction(message);
}

async function captureBug(message) {
  const payload = typeof message?.payload === 'string' ? message.payload : '';
  if (!payload.trim()) throw failure('BUG_CAPTURE_PAYLOAD_REQUIRED', '没有找到完整 AICC_BUG_CAPTURE_V1 payload。', '等待 GPT 输出完整协议块后重试。');
  return request('/api/gpt-bridge/bug-capture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload, originContext: message.originContext }) });
}

async function localSyncBugRegistry(message) {
  const payload = message?.payload;
  if (!payload || typeof payload.repository !== 'string' || typeof payload.branch !== 'string' || typeof payload.registryPath !== 'string' || typeof payload.sourceCommitSha !== 'string' || payload.action !== 'SYNC') throw failure('LOCAL_SYNC_PAYLOAD_REQUIRED', '缺少完整 Bug Registry Local Sync 协议。', '等待 GPT 输出完整协议块后重试。');
  const key = `${payload.sourceCommitSha}|${payload.registryPath}`, stored = (await chrome.storage.local.get(LOCAL_SYNC_KEY))[LOCAL_SYNC_KEY] || {};
  if (stored[key]?.result === 'SYNCED' || stored[key]?.result === 'ALREADY_SYNCED') return { result: { ...stored[key], result: 'ALREADY_SYNCED' } };
  const body = await request('/api/bug-registry/local-sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (body?.result?.result === 'SYNCED' || body?.result?.result === 'ALREADY_SYNCED') await chrome.storage.local.set({ [LOCAL_SYNC_KEY]: { ...stored, [key]: body.result } });
  return body;
}

async function pollResult(message) {
  const correlationKey = scopedStorageKey(CORRELATION_KEY, message.bridgeScopeId);
  const stored = (await chrome.storage.local.get(correlationKey))[correlationKey];
  let correlation = message.correlation || stored;
  if (!correlation?.inboxId) return { item: null, correlation: null };
  if (!correlation.runId || !correlation.projectId || !correlation.repositoryIdentity) {
    const inboxBody = await request('/api/gpt-bridge/inbox');
    const inbox = (Array.isArray(inboxBody.items) ? inboxBody.items : []).find(candidate => candidate.id === correlation.inboxId) || null;
    if (inbox) correlation = { ...correlation, taskId: correlation.taskId || inbox.taskId, instructionId: correlation.instructionId || inbox.instruction?.instructionId, executionId: correlation.executionId || inbox.executionId, runId: correlation.runId || inbox.runId, projectId: correlation.projectId || inbox.projectId, repositoryIdentity: correlation.repositoryIdentity || inbox.repositoryIdentity };
  }
  if (!correlation.runId || !correlation.projectId || !correlation.repositoryIdentity) return { item: null, correlation };
  const query = new URLSearchParams({ projectId: correlation.projectId, repositoryIdentity: correlation.repositoryIdentity, runId: correlation.runId });
  const body = await request(`/api/tasks/result?${query}`);
  await chrome.storage.local.set({ [correlationKey]: correlation });
  return { item: body.item || null, correlation };
}

async function remoteClaudeStatus() {
  return request('/api/gpt-bridge/remote-claude-status');
}

async function returnResult(message) {
  const correlationKey = scopedStorageKey(CORRELATION_KEY, message.bridgeScopeId);
  const stored = (await chrome.storage.local.get(correlationKey))[correlationKey];
  const correlation = message.correlation || stored;
  if (!correlation?.inboxId || !correlation.originContext?.conversationId) throw failure('EXACT_ORIGIN_UNAVAILABLE', '找不到原始 ChatGPT 会话。', '返回原始对话后重试。');
  if (message.sourceReference !== correlation.sourceReference || message.originContext?.conversationId !== correlation.originContext.conversationId) throw failure('EXACT_ORIGIN_UNAVAILABLE', '当前页面不是原始 ChatGPT 会话。', '返回原始对话后重试。');
  const polled = await pollResult({ correlation, bridgeScopeId: message.bridgeScopeId });
  const item = polled.item;
  const result = item?.report?.canonicalResult;
  if (!item?.runId || !result?.rawResult) throw failure('CANONICAL_RESULT_NOT_AVAILABLE', 'NOT_AVAILABLE', 'Codex result payload is absent.');
  const identity = { projectId: result.projectId, repositoryIdentity: result.repositoryIdentity, executionId: result.executionId || item.runId, resultId: result.resultId, resultHash: result.resultHash, originConversationId: correlation.originContext.conversationId, originMessageId: correlation.originContext.messageId, originBlockId: correlation.originContext.blockId };
  const claim = await request('/api/gpt-bridge/return/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(identity) });
  if (claim.alreadyReturned || claim.state === 'RETURNED_TO_GPT' || claim.state === 'CLOSED') return { alreadyReturned: true, result: claim.result, correlation };
  if (!claim.ok || claim.state !== 'RETURN_SUBMITTING') throw failure(claim.code || 'GPT_RETURN_CLAIM_FAILED', claim.reason || 'AICC 未能准备结果返回。', '保留当前结果并稍后重试。');
  if (claim.claimGranted !== true) return { deliveryInProgress: true, result: claim.result, correlation };
  return { result: claim.result, envelope: claim.result.rawResult, identity, correlation };
}

async function completeReturn(message) {
  return request('/api/gpt-bridge/return/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(message.identity) });
}
async function failReturn(message) {
  return request('/api/gpt-bridge/return/fail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...message.identity, reason: message.reason || 'GPT_RETURN_DELIVERY_FAILED' }) });
}

async function markReportInserted(message) {
  if (!message?.runId || !message?.sourceReference) throw failure('INSERT_CORRELATION_REQUIRED', '缺少原始 ChatGPT 会话关联。', '返回原始对话后重试。');
  const correlationKey = scopedStorageKey(CORRELATION_KEY, message.bridgeScopeId);
  const correlation = (await chrome.storage.local.get(correlationKey))[correlationKey];
  if (!correlation || correlation.runId !== message.runId || correlation.sourceReference !== message.sourceReference) throw failure('INSERT_CORRELATION_MISMATCH', '运行报告与当前 ChatGPT 会话不匹配。', '仅在原始对话中插入运行报告。');
  return { inserted: true, runId: message.runId };
}

async function codexCatalog() {
  return request('/api/providers/codex');
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const operation = message?.type === 'SEND_INSTRUCTION' ? sendInstruction({ ...message, tabId: sender?.tab?.id }) : message?.type === 'IMPORT_AND_RUN' ? importAndRun({ ...message, tabId: sender?.tab?.id }) : message?.type === 'BUG_CAPTURE' ? captureBug(message) : message?.type === 'BUG_REGISTRY_LOCAL_SYNC' ? localSyncBugRegistry(message) : message?.type === 'RECONCILE_SUBMISSION' ? reconcileSubmission(message) : message?.type === 'CODEX_CATALOG' ? codexCatalog() : message?.type === 'REMOTE_CLAUDE_STATUS' ? remoteClaudeStatus() : message?.type === 'POLL_RESULT' ? pollResult(message) : message?.type === 'RETURN_RESULT' ? returnResult(message) : message?.type === 'MARK_RETURN_COMPLETE' ? completeReturn(message) : message?.type === 'MARK_RETURN_FAILED' ? failReturn(message) : message?.type === 'MARK_REPORT_INSERTED' ? markReportInserted(message) : message?.type === 'AUTO_LOOP_STATUS' ? autoLoopStatus(message) : message?.type === 'AUTO_LOOP_BIND' ? autoLoopBind(message) : message?.type === 'AUTO_LOOP_UNBIND' ? autoLoopUnbind(message) : message?.type === 'AUTO_LOOP_MODE' ? autoLoopMode(message) : message?.type === 'AUTO_LOOP_FEEDBACK' ? autoLoopFeedback(message) : message?.type === 'AUTO_LOOP_FEEDBACK_STATE' ? autoLoopFeedbackState(message) : message?.type === 'AUTO_LOOP_CONTROL' ? autoLoopControl(message) : message?.type === 'AUTO_LOOP_CORRELATION_RECOVER' ? autoLoopCorrelationRecover(message) : Promise.reject(failure('MESSAGE_UNSUPPORTED', '不支持的适配器消息。', '刷新 ChatGPT 页面后重试。'));
  operation.then(value => sendResponse({ ok: true, ...value })).catch(error => sendResponse({ ok: false, error: error?.code ? error : failure('WEB_ADAPTER_ERROR', '适配器操作失败。', '检查 AICC 服务后重试。') }));
  return true;
});
