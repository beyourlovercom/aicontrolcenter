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
  let reportAlreadyInserted = false;

  function first(selectors) { return selectors.map(selector => document.querySelector(selector)).find(Boolean) || null; }
  function composer() { return first(window.AICCChatGPTDom.SELECTORS.composer); }
  function selectedText() { return window.getSelection?.().toString().trim() || ''; }
  function setStatus(message, state) { const status = panel?.querySelector(SELECTORS.status); if (status) { status.textContent = message; status.dataset.aiccState = state; } }
  function showError(error) { setStatus(error?.reason || '适配器操作失败。', 'ERROR'); }
  function message(type, data = {}) { return new Promise(resolve => chrome.runtime.sendMessage({ type, ...data }, resolve)); }

  async function sendTask(text, originContext, source) {
    if (!String(text || '').trim()) return showError({ reason: '没有找到可发送的任务内容。' });
    text = String(text).trim();
    setStatus(`已识别 · 来源: ${source}`, 'RUNNING');
    setStatus('正在发送到 AICC…', 'RUNNING');
    const result = await message('SEND_INSTRUCTION', { text, sourceReference: location.href, originContext });
    if (!result?.ok) return showError(result?.error);
    setStatus(`已发送到 AICC · 来源: ${source} · Inbox: ${result.item.id} · 状态: ${result.item.state}`, 'SUCCESS');
    await pollResult();
  }
  async function sendInstruction() { const resolved = window.AICCChatGPTDom.resolveTaskSource(document, selectedText()); return sendTask(resolved.text, window.AICCChatGPTDom.originContext(document, resolved.message), resolved.source); }
  function mountNativeActions() { window.AICCChatGPTDom.mountAssistantAiccActions(document, sendTask); window.AICCChatGPTDom.mountComposerAiccAction(document, sendTask); }

  async function pollResult() {
    const result = await message('POLL_RESULT');
    if (!result?.ok) return showError(result?.error);
    reportItem = result.item || null;
    reportCorrelation = result.correlation || null;
    reportAlreadyInserted = Boolean(result.alreadyInserted);
    if (reportItem && reportCorrelation?.sourceReference === location.href && !reportAlreadyInserted) await insertReport(true);
    else if (reportItem) setStatus(reportAlreadyInserted ? '运行报告已插入原始对话' : `运行报告已就绪 · Run ID: ${reportItem.report?.runId || reportItem.runId || 'ABSENT'}`, 'SUCCESS');
  }

  function reportText(item) {
    const report = item?.report || {};
    return ['AICC_RUN_REPORT_V1', `Run ID: ${report.runId || item.runId || 'ABSENT'}`, `Entity: ${report.entityId || 'ABSENT'}`, `Execution type: ${report.executionType || 'UNAVAILABLE'}`, '', `Runtime Result: ${report.runtimeResult || 'UNAVAILABLE'}`, `Gate Result: ${report.gateResult || 'UNAVAILABLE'}`, '', 'Summary:', `${report.summary || 'UNAVAILABLE'}`].join('\n');
  }

  async function insertReport(auto = false) {
    if (!reportItem) return setStatus('暂无匹配的 AICC_RUN_REPORT_V1。', 'BLOCKED');
    if (reportAlreadyInserted) return setStatus('运行报告已插入原始对话。', 'SUCCESS');
    if (reportCorrelation?.sourceReference !== location.href) return setStatus(auto ? '当前不是原始 ChatGPT 对话，报告保持待插入。' : '请返回原始 ChatGPT 对话后插入运行报告。', 'BLOCKED');
    const target = composer();
    if (!target) return showError({ reason: '找不到 ChatGPT 当前编辑框，报告保持待插入。' });
    const text = reportText(reportItem);
    const inserted = window.AICCChatGPTDom.insertTextIntoComposer(target, text);
    if (!inserted || !(await window.AICCChatGPTDom.verifyComposerText(target, text))) return setStatus('运行报告插入失败：ChatGPT 编辑器未保留报告格式。', 'ERROR');
    const marked = await message('MARK_REPORT_INSERTED', { runId: reportItem.runId || reportItem.report?.runId, sourceReference: location.href });
    if (!marked?.ok) return showError(marked?.error);
    reportAlreadyInserted = true;
    setStatus('运行报告已插入编辑框，请由 Owner 手动发送。', 'SUCCESS');
  }

  function mount() {
    if (document.querySelector(SELECTORS.mount)) return;
    panel = document.createElement('aside');
    panel.dataset.aiccGptBridgeExtension = 'true';
    panel.innerHTML = '<strong>AICC Bridge</strong><button data-aicc-send>发送到 AICC</button><button data-aicc-insert>插入运行报告</button><div data-aicc-status>AICC 可用性检查中…</div>';
    panel.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;display:grid;gap:7px;width:220px;padding:12px;border:1px solid #d8dee8;border-radius:10px;background:#fff;box-shadow:0 8px 28px #0002;font:13px system-ui;color:#1f2937';
    document.body.appendChild(panel);
    panel.querySelector(SELECTORS.send).addEventListener('click', sendInstruction);
    panel.querySelector(SELECTORS.insert).addEventListener('click', insertReport);
    pollResult().then(() => { if (!reportItem) setStatus('AICC 可用 · 等待 Owner 操作', 'IDLE'); });
  }

  if (document.body) { mount(); mountNativeActions(); } else new MutationObserver(mount).observe(document.documentElement, { childList: true });
  window.setInterval(mountNativeActions, 1000);
  window.setInterval(pollResult, 3000);
}());
