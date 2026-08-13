(function () {
  'use strict';
  if (window.__AICC_GPT_BRIDGE_EXTENSION__) return;
  window.__AICC_GPT_BRIDGE_EXTENSION__ = true;

  const SELECTORS = Object.freeze({
    composer: ['[contenteditable="true"]', 'textarea'],
    mount: '[data-aicc-gpt-bridge-extension]',
    send: '[data-aicc-send]',
    insert: '[data-aicc-insert]',
    status: '[data-aicc-status]'
  });
  let panel;
  let reportItem = null;

  function first(selectors) { return selectors.map(selector => document.querySelector(selector)).find(Boolean) || null; }
  function composer() { return first(SELECTORS.composer); }
  function composerText(target) { return target && ('value' in target ? target.value : target.innerText || target.textContent || ''); }
  function selectedText() { return window.getSelection?.().toString().trim() || ''; }
  function setStatus(message, state) { const status = panel?.querySelector(SELECTORS.status); if (status) { status.textContent = message; status.dataset.aiccState = state; } }
  function showError(error) { setStatus(error?.reason || '适配器操作失败。', 'ERROR'); }
  function message(type, data = {}) { return new Promise(resolve => chrome.runtime.sendMessage({ type, ...data }, resolve)); }

  async function sendInstruction() {
    const resolved = window.AICCChatGPTDom.resolveInstructionSource(document, selectedText());
    if (!resolved.block) return showError({ reason: resolved.error === 'AMBIGUOUS_INSTRUCTION' ? '发现多个 AICC_EXECUTION_V1 指令，无法安全判断目标。请选中唯一指令后重试。' : '没有找到可发送的完整 AICC_EXECUTION_V1 指令。请确认 Assistant 回复或 composer 中包含完整协议块。' });
    const text = resolved.block;
    setStatus(`已识别 · 来源: ${resolved.source}`, 'RUNNING');
    setStatus('正在发送到 AICC…', 'RUNNING');
    const result = await message('SEND_INSTRUCTION', { text, sourceReference: location.href });
    if (!result?.ok) return showError(result?.error);
    setStatus(`已发送到 AICC · 来源: ${resolved.source} · Inbox: ${result.item.id} · 状态: ${result.item.state}`, 'SUCCESS');
    await pollResult();
  }

  async function pollResult() {
    const result = await message('POLL_RESULT');
    if (!result?.ok) return showError(result?.error);
    reportItem = result.item || null;
    if (reportItem) setStatus(`运行报告已就绪 · Run ID: ${reportItem.report?.runId || reportItem.runId || 'ABSENT'}`, 'SUCCESS');
  }

  function reportText(item) {
    const report = item?.report || {};
    return ['AICC_RUN_REPORT_V1', `Run ID: ${report.runId || item.runId || 'ABSENT'}`, `Entity: ${report.entityId || 'ABSENT'}`, `Execution type: ${report.executionType || 'UNAVAILABLE'}`, `Runtime result: ${report.runtimeResult || 'UNAVAILABLE'}`, `Gate result: ${report.gateResult || 'UNAVAILABLE'}`, `Summary: ${report.summary || 'UNAVAILABLE'}`].join('\n');
  }

  function insertReport() {
    if (!reportItem) return setStatus('暂无匹配的 AICC_RUN_REPORT_V1。', 'BLOCKED');
    const target = composer();
    if (!target) return showError({ reason: '找不到 ChatGPT 当前编辑框。请使用 AICC 的复制回退。' });
    const text = reportText(reportItem);
    if ('value' in target) target.value = text; else target.textContent = text;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.focus();
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

  if (document.body) mount(); else new MutationObserver(mount).observe(document.documentElement, { childList: true });
  window.setInterval(pollResult, 3000);
}());
