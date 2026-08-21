(function () {
  'use strict';
  if (window.__AICC_GPT_BRIDGE_EXTENSION__) return;
  window.__AICC_GPT_BRIDGE_EXTENSION__ = true;

  const SELECTORS = Object.freeze({
    mount: '[data-aicc-gpt-bridge-extension]',
    send: '[data-aicc-send]',
    insert: '[data-aicc-insert]',
    status: '[data-aicc-status]'
  });
  let panel;
  let reportItem = null;
  let reportCorrelation = null;
  const AUTO_REPORT_INSERT_DEFAULT = false;
  const MANUAL_REPORT_INSERT_AVAILABLE = true;

  function first(selectors) { return selectors.map(selector => document.querySelector(selector)).find(Boolean) || null; }
  function composer() { return first(window.AICCChatGPTDom.SELECTORS.composer); }
  function selectedText() { return window.getSelection?.().toString().trim() || ''; }
  function setStatus(message, state) { const status = panel?.querySelector(SELECTORS.status); if (status) { status.textContent = message; status.dataset.aiccState = state; } }
  function showError(error) { setStatus(error?.reason || '适配器操作失败。', 'ERROR'); }
  function message(type, data = {}) { return new Promise(resolve => chrome.runtime.sendMessage({ type, ...data }, resolve)); }
  function isInsertableReport(item) { return item?.state === 'READY' && Boolean(item?.runId || item?.report?.runId); }
  function syncManualReportButton() { const button = panel?.querySelector(SELECTORS.insert); if (!button) return; const ready = isInsertableReport(reportItem); button.disabled = !ready; button.setAttribute('aria-disabled', String(!ready)); button.title = ready ? '插入当前运行报告' : '暂无可用运行报告'; }
  function ensureManualReportButton() { if (!panel) return; let button = panel.querySelector(SELECTORS.insert); if (!button) { button = document.createElement('button'); button.dataset.aiccInsert = 'true'; button.textContent = '插入运行报告'; panel.appendChild(button); } if (button.dataset.aiccBound !== 'true') { button.addEventListener('click', requestReportDelivery); button.dataset.aiccBound = 'true'; } syncManualReportButton(); }

  async function sendTask(text, originContext, source, operation = 'SEND_INSTRUCTION') {
    if (!String(text || '').trim()) { const error = { reason: '没有找到可发送的任务内容。', code: 'INSTRUCTION_TEXT_REQUIRED' }; showError(error); throw error; }
    text = String(text).trim();
    setStatus(`已识别 · 来源: ${source}`, 'RUNNING');
    setStatus('正在发送到 AICC…', 'RUNNING');
    const result = await message(operation, { text, sourceReference: location.href, originContext });
    if (!result?.ok) { showError(result?.error); throw result?.error || new Error('AICC_SUBMISSION_FAILED'); }
    setStatus(`已发送到 AICC · 来源: ${source} · Inbox: ${result.item.id} · 状态: ${result.item.state}`, 'SUCCESS');
    await pollResult();
  }
  async function sendInstruction() { const resolved = window.AICCChatGPTDom.resolveTaskSource(document, selectedText()); return sendTask(resolved.text, window.AICCChatGPTDom.originContext(document, resolved.message), resolved.source); }
  function mountNativeActions() { const canonicalImportAndRun = (text, originContext, message) => sendTask(text, originContext, message ? 'Assistant' : 'Composer', 'IMPORT_AND_RUN'); window.AICCChatGPTDom.mountAssistantAiccActions(document, canonicalImportAndRun); window.AICCChatGPTDom.mountComposerAiccAction(document, canonicalImportAndRun); }

  async function pollResult() {
    const result = await message('POLL_RESULT');
    if (!result?.ok) { showError(result?.error); return result; }
    reportItem = result.item?.item || result.item || null;
    reportCorrelation = result.correlation || result.item?.correlation || null;
    ensureManualReportButton();
    if (reportItem) { setStatus(`${AUTO_REPORT_INSERT_DEFAULT ? '运行报告已自动处理' : '运行报告已就绪'} · Run ID: ${reportItem.report?.runId || reportItem.runId || 'ABSENT'}`, 'SUCCESS'); void deliverCanonicalResult(); }
    return result;
  }

  async function deliverCanonicalResult() {
    if (!reportItem?.report?.canonicalResult?.rawResult || !reportCorrelation?.originContext?.conversationId) return;
    const result = await message('RETURN_RESULT', { sourceReference: location.href, originContext: window.AICCChatGPTDom.originContext(document, null), correlation: reportCorrelation });
    if (!result?.ok) { showError(result?.error); return; }
    if (result.alreadyReturned) { setStatus('运行结果已返回原始对话。', 'SUCCESS'); return; }
    const target = composer();
    if (!target) { await message('MARK_RETURN_FAILED', { identity: result.identity, reason: 'ORIGIN_COMPOSER_UNAVAILABLE' }); setStatus('原始对话编辑框不可用，结果保持待返回。', 'ERROR'); return; }
    const inserted = window.AICCChatGPTDom.reportFormatPresent(target, result.envelope) || (window.AICCChatGPTDom.insertTextIntoComposer(target, result.envelope) && await window.AICCChatGPTDom.verifyComposerText(target, result.envelope));
    if (!inserted) { await message('MARK_RETURN_FAILED', { identity: result.identity, reason: 'COMPOSER_INSERT_FAILED' }); setStatus('运行结果返回失败，原始结果已保留。', 'ERROR'); return; }
    const completed = await message('MARK_RETURN_COMPLETE', { identity: result.identity });
    if (!completed?.ok) { showError(completed?.error); return; }
    setStatus('运行结果已返回原始对话，请由 Owner 手动发送。', 'SUCCESS');
  }

  function reportText(item) {
    const report = item?.report || {};
    return ['AICC_RUN_REPORT_V1', `Run ID: ${report.runId || item.runId || 'ABSENT'}`, `Entity: ${report.entityId || 'ABSENT'}`, `Execution type: ${report.executionType || 'UNAVAILABLE'}`, '', `Runtime Result: ${report.runtimeResult || 'UNAVAILABLE'}`, `Gate Result: ${report.gateResult || 'UNAVAILABLE'}`, '', 'Summary:', `${report.summary || 'UNAVAILABLE'}`].join('\n');
  }

  async function insertReport() {
    if (!isInsertableReport(reportItem)) return setStatus('暂无可用的 AICC_RUN_REPORT_V1。', 'BLOCKED');
    if (reportCorrelation?.sourceReference !== location.href || reportCorrelation?.originContext?.conversationId !== window.AICCChatGPTDom.originContext(document, null).conversationId) return setStatus('请返回原始 ChatGPT 对话后插入运行报告。', 'BLOCKED');
    const target = composer();
    if (!target) return showError({ reason: '找不到 ChatGPT 当前编辑框，报告保持待插入。' });
    const text = reportText(reportItem);
    if (window.AICCChatGPTDom.reportFormatPresent(target, text)) { const marked = await message('MARK_REPORT_INSERTED', { runId: reportItem.runId || reportItem.report?.runId, reportVersion: reportItem.report?.version, sourceReference: location.href }); if (!marked?.ok) return showError(marked.error); return setStatus('运行报告已插入原始对话。', 'SUCCESS'); }
    const inserted = window.AICCChatGPTDom.insertTextIntoComposer(target, text);
    if (!inserted || !(await window.AICCChatGPTDom.verifyComposerText(target, text))) return setStatus('运行报告插入失败：ChatGPT 编辑器未保留报告格式。', 'ERROR');
    const marked = await message('MARK_REPORT_INSERTED', { runId: reportItem.runId || reportItem.report?.runId, reportVersion: reportItem.report?.version, sourceReference: location.href });
    if (!marked?.ok) return showError(marked?.error);
    setStatus('运行报告已插入编辑框，请由 Owner 手动发送。', 'SUCCESS');
  }

  async function requestReportDelivery() {
    const result = await pollResult();
    if (!result?.ok || !isInsertableReport(reportItem)) return setStatus('暂无可用的 AICC_RUN_REPORT_V1。', 'BLOCKED');
    await insertReport();
  }

  function mount() {
    const existing = document.querySelector(SELECTORS.mount);
    if (existing) { panel = existing; ensureManualReportButton(); return; }
    panel = document.createElement('aside');
    panel.dataset.aiccGptBridgeExtension = 'true';
    panel.innerHTML = '<strong>AICC Bridge</strong><button data-aicc-send>发送到 AICC</button><button data-aicc-insert>插入运行报告</button><div data-aicc-status>AICC 可用性检查中…</div>';
    panel.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;display:grid;gap:7px;width:220px;padding:12px;border:1px solid #d8dee8;border-radius:10px;background:#fff;box-shadow:0 8px 28px #0002;font:13px system-ui;color:#1f2937';
    document.body.appendChild(panel);
    panel.querySelector(SELECTORS.send).addEventListener('click', sendInstruction);
    ensureManualReportButton();
    pollResult().then(() => { if (!reportItem) setStatus('AICC 可用 · 等待 Owner 操作', 'IDLE'); });
  }

  if (document.body) { mount(); mountNativeActions(); } else new MutationObserver(mount).observe(document.documentElement, { childList: true, subtree: true });
  window.setInterval(() => { mount(); mountNativeActions(); }, 1000);
  window.setInterval(mountNativeActions, 1000);
  window.setInterval(pollResult, 3000);
}());
