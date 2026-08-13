(function () {
  'use strict';
  if (window.__AICC_GPT_BRIDGE_V1__) return;
  window.__AICC_GPT_BRIDGE_V1__ = true;

  var endpoint = 'http://127.0.0.1:1420';
  var key = 'aicc-gpt-bridge-adapter-correlation-v1';
  var panel;
  var reportItem = null;

  function composer() { return window.AICCChatGPTDom && document.querySelector(window.AICCChatGPTDom.SELECTORS.composer.join(',')); }
  function textOf(element) { return element && ('value' in element ? element.value : element.innerText || element.textContent || ''); }
  function show(message, state) {
    var status = panel && panel.querySelector('[data-aicc-status]');
    if (status) { status.textContent = message; status.dataset.aiccState = state || 'IDLE'; }
  }
  function visibleError(error) {
    show((error && error.reason) || '适配器操作失败。', 'ERROR');
  }
  function request(path, init) {
    return fetch(endpoint + path, init).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) throw { reason: 'AICC 本地服务拒绝了请求。', code: 'AICC_HTTP_' + response.status };
        return body;
      });
    }).catch(function (error) {
      if (error && error.reason) throw error;
      throw { reason: '无法连接 AICC 本地服务。确认 127.0.0.1:1420 可用后重试。', code: 'AICC_UNAVAILABLE' };
    });
  }
  function send() {
    var resolved = window.AICCChatGPTDom.resolveInstructionSource(document, window.getSelection && window.getSelection().toString().trim());
    if (!resolved.block) return visibleError({ reason: resolved.error === 'AMBIGUOUS_INSTRUCTION' ? '发现多个 AICC_EXECUTION_V1 指令，无法安全判断目标。请选中唯一指令后重试。' : '没有找到可发送的完整 AICC_EXECUTION_V1 指令。请确认 Assistant 回复或 composer 中包含完整协议块。' });
    var text = resolved.block;
    show('正在发送到 AICC…', 'RUNNING');
    request('/api/gpt-bridge/inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload: text, sourceType: 'WEB_BRIDGE', sourceReference: location.href }) })
      .then(function (body) {
        var item = body.item;
        if (!item || !item.id) throw { reason: 'AICC 返回了无法识别的 Inbox 结果。', code: 'INBOX_RESPONSE_INVALID' };
        if (item.state === 'INVALID') throw { reason: (item.parseErrors && item.parseErrors[0]) || 'AICC_EXECUTION_V1 指令无效。请修正后重试。', code: 'INVALID_EXECUTION_INSTRUCTION' };
        localStorage.setItem(key, JSON.stringify({ inboxId: item.id, instructionId: item.instruction && item.instruction.instructionId, sentAt: new Date().toISOString() }));
        show('已发送到 AICC · 来源: ' + resolved.source + ' · Inbox: ' + item.id + ' · 状态: ' + item.state, 'SUCCESS');
        poll();
      }).catch(visibleError);
  }
  function poll() {
    var raw = localStorage.getItem(key); if (!raw) return;
    var correlation; try { correlation = JSON.parse(raw); } catch (_) { return; }
    request('/api/gpt-bridge/outbox').then(function (body) {
      reportItem = (body.items || []).find(function (item) { return item.inboxId === correlation.inboxId && (!correlation.runId || item.runId === correlation.runId); }) || null;
      if (reportItem) show('运行报告已就绪 · Run ID: ' + ((reportItem.report && reportItem.report.runId) || reportItem.runId || 'ABSENT'), 'SUCCESS');
    }).catch(function () { show('暂时无法读取运行结果，请稍后重试。', 'ERROR'); });
  }
  async function insert() {
    if (!reportItem) return show('暂无匹配的 AICC_RUN_REPORT_V1。', 'BLOCKED');
    var report = reportItem.report || {};
    var text = ['AICC_RUN_REPORT_V1', 'Run ID: ' + (report.runId || reportItem.runId || 'ABSENT'), 'Entity: ' + (report.entityId || 'ABSENT'), 'Execution type: ' + (report.executionType || 'UNAVAILABLE'), '', 'Runtime Result: ' + (report.runtimeResult || 'UNAVAILABLE'), 'Gate Result: ' + (report.gateResult || 'UNAVAILABLE'), '', 'Summary:', (report.summary || 'UNAVAILABLE')].join('\n');
    var target = composer(); if (!target) return show('找不到 ChatGPT 当前编辑框。请使用复制回退。', 'ERROR');
    var inserted = window.AICCChatGPTDom.insertTextIntoComposer(target, text);
    if (!inserted || !(await window.AICCChatGPTDom.verifyComposerText(target, text))) return show('运行报告插入失败：ChatGPT 编辑器未保留报告格式。', 'ERROR');
    show('运行报告已插入编辑框，请由 Owner 手动发送。', 'SUCCESS');
  }
  function mount() {
    if (document.querySelector('[data-aicc-gpt-bridge]')) return;
    panel = document.createElement('aside'); panel.dataset.aiccGptBridge = 'true';
    panel.innerHTML = '<strong>AICC Bridge</strong><button data-aicc-send>发送到 AICC</button><button data-aicc-insert>插入运行报告</button><div data-aicc-status>等待 Owner 操作</div>';
    panel.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;display:grid;gap:7px;width:220px;padding:12px;border:1px solid #d8dee8;border-radius:10px;background:#fff;box-shadow:0 8px 28px #0002;font:13px system-ui;color:#1f2937';
    document.body.appendChild(panel); panel.querySelector('[data-aicc-send]').addEventListener('click', send); panel.querySelector('[data-aicc-insert]').addEventListener('click', insert); poll();
  }
  if (document.body) mount(); else new MutationObserver(mount).observe(document.documentElement, { childList: true });
  setInterval(poll, 3000);
}());
