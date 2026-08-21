const AICC_ORIGIN = 'http://127.0.0.1:1420';
const CORRELATION_KEY = 'aicc-gpt-bridge-adapter-correlation-v1';

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
    const serverError = typeof body.error === 'string' ? body.error : body.error?.code;
    throw failure(`AICC_HTTP_${response.status}`, `AICC 拒绝请求：HTTP ${response.status} · ${serverError || 'UNKNOWN_ERROR'}`, '根据错误原因修正请求后重试。');
  }
  return body;
}

async function sendInstruction(message) {
  const text = typeof message.text === 'string' ? message.text : '';
  if (!text.trim()) throw { ...failure('INSTRUCTION_TEXT_REQUIRED', '没有找到可发送的任务内容。', '在 ChatGPT 编辑框中输入任务后重试。'), state: 'BLOCKED' };
  const body = await request('/api/gpt-bridge/inbox', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload: text, sourceType: 'WEB_BRIDGE', sourceReference: message.sourceReference, originContext: message.originContext })
  });
  const item = body.item;
  if (!item || !item.id) throw failure('INBOX_RESPONSE_INVALID', 'AICC 返回了无法识别的 Inbox 结果。', '检查本地服务日志后重试。');
  if (item.state === 'INVALID') throw { ...failure('INVALID_EXECUTION_INSTRUCTION', item.parseErrors?.[0] || item.error || 'AICC_EXECUTION_V1 指令无效。', '修正指令格式后重新发送。'), state: 'BLOCKED' };
  const correlation = { inboxId: item.id, instructionId: item.instruction?.instructionId, sourceReference: message.sourceReference, originContext: message.originContext, tabId: message.tabId, sentAt: new Date().toISOString() };
  await chrome.storage.local.set({ [CORRELATION_KEY]: correlation });
  return { item, correlation };
}

async function importAndRun(message) {
  const received = await sendInstruction(message);
  const launched = await request('/api/gpt-bridge/launch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inboxId: received.item.id }) });
  return { ...received, item: launched.item || received.item };
}

async function pollResult(message) {
  const stored = (await chrome.storage.local.get(CORRELATION_KEY))[CORRELATION_KEY];
  const correlation = message.correlation || stored;
  if (!correlation?.inboxId) return { item: null, correlation: null };
  const body = await request('/api/gpt-bridge/outbox');
  const item = (Array.isArray(body.items) ? body.items : []).find(candidate => candidate.inboxId === correlation.inboxId && (!correlation.runId || candidate.runId === correlation.runId)) || null;
  const resolvedCorrelation = item?.runId && !correlation.runId ? { ...correlation, runId: item.runId } : correlation;
  if (item?.runId && !correlation.runId) await chrome.storage.local.set({ [CORRELATION_KEY]: resolvedCorrelation });
  return { item, correlation: resolvedCorrelation };
}

function returnEnvelope(result) {
  return ['AICC_EXECUTION_RESULT_V1', `EXECUTION_ID: ${result.executionId}`, `INSTRUCTION_ID: ${result.instructionId || 'NONE'}`, `AICC_STATUS: ${result.aiccStatus || 'RESULT_RECEIVED'}`, `CODEX_RESULT: ${result.codexResult || 'UNKNOWN'}`, `CODEX_REASON: ${result.codexReason || 'NONE'}`, '', 'RESULT_BEGIN', result.rawResult, 'RESULT_END'].join('\n');
}
async function returnResult(message) {
  const stored = (await chrome.storage.local.get(CORRELATION_KEY))[CORRELATION_KEY];
  const correlation = message.correlation || stored;
  if (!correlation?.inboxId || !correlation.originContext?.conversationId) throw failure('EXACT_ORIGIN_UNAVAILABLE', '找不到原始 ChatGPT 会话。', '返回原始对话后重试。');
  if (message.sourceReference !== correlation.sourceReference || message.originContext?.conversationId !== correlation.originContext.conversationId) throw failure('EXACT_ORIGIN_UNAVAILABLE', '当前页面不是原始 ChatGPT 会话。', '返回原始对话后重试。');
  const polled = await pollResult({ correlation });
  const item = polled.item;
  const result = item?.report?.canonicalResult;
  if (!item?.runId || !result?.rawResult) throw failure('CANONICAL_RESULT_UNAVAILABLE', 'Canonical Codex 结果尚未就绪。', '等待运行完成后重试。');
  const identity = { executionId: result.executionId || item.runId, resultId: result.resultId, resultHash: result.resultHash, originConversationId: correlation.originContext.conversationId, originMessageId: correlation.originContext.messageId, originBlockId: correlation.originContext.blockId };
  const claim = await request('/api/gpt-bridge/return/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(identity) });
  if (claim.alreadyReturned || claim.state === 'RETURNED_TO_GPT' || claim.state === 'CLOSED') return { alreadyReturned: true, result: claim.result, correlation };
  if (!claim.ok || claim.state !== 'RETURN_SUBMITTING') throw failure(claim.code || 'GPT_RETURN_CLAIM_FAILED', claim.reason || 'AICC 未能准备结果返回。', '保留当前结果并稍后重试。');
  return { result: claim.result, envelope: returnEnvelope(claim.result), identity, correlation };
}
async function completeReturn(message) {
  return request('/api/gpt-bridge/return/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(message.identity) });
}
async function failReturn(message) {
  return request('/api/gpt-bridge/return/fail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...message.identity, reason: message.reason || 'GPT_RETURN_DELIVERY_FAILED' }) });
}

async function markReportInserted(message) {
  if (!message?.runId || !message?.sourceReference) throw failure('INSERT_CORRELATION_REQUIRED', '缺少原始 ChatGPT 会话关联。', '返回原始对话后重试。');
  const correlation = (await chrome.storage.local.get(CORRELATION_KEY))[CORRELATION_KEY];
  if (!correlation || correlation.runId !== message.runId || correlation.sourceReference !== message.sourceReference) throw failure('INSERT_CORRELATION_MISMATCH', '运行报告与当前 ChatGPT 会话不匹配。', '仅在原始对话中插入运行报告。');
  return { inserted: true, runId: message.runId };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const operation = message?.type === 'SEND_INSTRUCTION' ? sendInstruction({ ...message, tabId: sender?.tab?.id }) : message?.type === 'IMPORT_AND_RUN' ? importAndRun({ ...message, tabId: sender?.tab?.id }) : message?.type === 'POLL_RESULT' ? pollResult(message) : message?.type === 'RETURN_RESULT' ? returnResult(message) : message?.type === 'MARK_RETURN_COMPLETE' ? completeReturn(message) : message?.type === 'MARK_RETURN_FAILED' ? failReturn(message) : message?.type === 'MARK_REPORT_INSERTED' ? markReportInserted(message) : Promise.reject(failure('MESSAGE_UNSUPPORTED', '不支持的适配器消息。', '刷新 ChatGPT 页面后重试。'));
  operation.then(value => sendResponse({ ok: true, ...value })).catch(error => sendResponse({ ok: false, error: error?.code ? error : failure('WEB_ADAPTER_ERROR', '适配器操作失败。', '检查 AICC 服务后重试。') }));
  return true;
});
