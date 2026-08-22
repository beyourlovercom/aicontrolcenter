(function () {
  'use strict';
  if (window.__AICC_GPT_BRIDGE_V1__) return;
  window.__AICC_GPT_BRIDGE_V1__ = true;

  var endpoint = 'http://127.0.0.1:1420';
  var key = 'aicc-gpt-bridge-adapter-correlation-v1';
  var insertedPrefix = 'aicc-gpt-bridge-report-inserted-';
  var lockPrefix = 'aicc-gpt-bridge-report-lock-';
  var panel;
  var reportItem = null;
  var localSyncKeys = {};

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
  function reportIdentity(item) { var report = item.report || {}; return [report.version || 'AICC_RUN_REPORT_V1', item.runId || report.runId || 'ABSENT', currentConversationId()].join(':'); }
  function reportMarker(item) { return insertedPrefix + reportIdentity(item); }
  function currentConversationId() { return window.AICCChatGPTDom.originContext(document, null).conversationId; }
  function acknowledge() { /* legacy adapter has no delivery-state authority; current Bridge owns return-state persistence */ }
  function sendText(text, originContext, source) {
    if (!String(text || '').trim()) return visibleError({ reason: '没有找到可发送的任务内容。' });
    text = String(text).trim();
    show('正在发送到 AICC…', 'RUNNING');
    request('/api/gpt-bridge/inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload: text, sourceType: 'WEB_BRIDGE', sourceReference: location.href, originContext: originContext }) })
      .then(function (body) {
        var item = body.item;
        if (!item || !item.id) throw { reason: 'AICC 返回了无法识别的 Inbox 结果。', code: 'INBOX_RESPONSE_INVALID' };
        if (item.state === 'INVALID') throw { reason: (item.parseErrors && item.parseErrors[0]) || 'AICC 任务无效。请修正后重试。', code: 'INVALID_EXECUTION_INSTRUCTION' };
        localStorage.setItem(key, JSON.stringify({ inboxId: item.id, taskId: item.taskId, instructionId: item.instruction && item.instruction.instructionId, executionId: item.executionId, runId: item.runId, projectId: item.projectId, repositoryIdentity: item.repositoryIdentity, sourceReference: location.href, originContext: originContext, sentAt: new Date().toISOString() }));
        show('已发送到 AICC · 来源: ' + source + ' · Inbox: ' + item.id + ' · 状态: ' + item.state, 'SUCCESS');
        poll();
      }).catch(visibleError);
  }
  function send() { var resolved = window.AICCChatGPTDom.resolveTaskSource(document, window.getSelection && window.getSelection().toString().trim()); sendText(resolved.text, window.AICCChatGPTDom.originContext(document, resolved.message), resolved.source); }
  function mountNativeActions() { window.AICCChatGPTDom.removeChatContentFloatingButtons(document); window.AICCChatGPTDom.mountComposerAiccAction(document, sendText); }
  function scanLocalSync() {
    if (!window.AICCChatGPTDom || !window.AICCChatGPTDom.assistantMessages) return;
    var messages = window.AICCChatGPTDom.assistantMessages(document);
    messages.forEach(function (assistant, index) {
      var text = window.AICCChatGPTDom.textOf(assistant) || '';
      var matches = text.match(/(?:^|\n)(AICC_BUG_REGISTRY_LOCAL_SYNC_V1\n[\s\S]*?\nEND_AICC_BUG_REGISTRY_LOCAL_SYNC_V1)(?=\n|$)/g) || [];
      matches.forEach(function (raw) {
        var block = raw.trim();
        function value(key) { var match = block.match(new RegExp('(?:^|\\n)' + key + ':\\s*([^\\n]+)')); return match ? match[1].trim() : ''; }
        var payload = { repository: value('REPOSITORY'), branch: value('BRANCH'), registryPath: value('REGISTRY_PATH'), sourceCommitSha: value('SOURCE_COMMIT_SHA'), action: value('ACTION') };
        if (payload.repository !== 'beyourlovercom/aicontrolcenter' || payload.branch !== 'rebuild/aicc-v2' || payload.registryPath !== 'docs/80_Bug_Record/01_bug_record.md' || !/^[a-f0-9]{40}$/i.test(payload.sourceCommitSha) || payload.action !== 'SYNC') return;
        var key = payload.sourceCommitSha + '|' + payload.registryPath; if (localSyncKeys[key]) return; localSyncKeys[key] = true;
        request('/api/bug-registry/local-sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(function (body) { show('BUG REGISTRY · ' + ((body.result && body.result.result) || 'FAILED'), body.result && body.result.result === 'FAILED' ? 'ERROR' : 'SUCCESS'); }).catch(visibleError);
      });
    });
  }
  function poll() {
    var raw = localStorage.getItem(key); if (!raw) return;
    var correlation; try { correlation = JSON.parse(raw); } catch (_) { return; }
    var resolveExact = correlation.runId && correlation.projectId && correlation.repositoryIdentity
      ? Promise.resolve(correlation)
      : request('/api/gpt-bridge/inbox').then(function (body) {
          var inbox = (body.items || []).find(function (item) { return item.id === correlation.inboxId; }) || null;
          if (!inbox) return correlation;
          correlation = Object.assign({}, correlation, { taskId: correlation.taskId || inbox.taskId, instructionId: correlation.instructionId || (inbox.instruction && inbox.instruction.instructionId), executionId: correlation.executionId || inbox.executionId, runId: correlation.runId || inbox.runId, projectId: correlation.projectId || inbox.projectId, repositoryIdentity: correlation.repositoryIdentity || inbox.repositoryIdentity });
          localStorage.setItem(key, JSON.stringify(correlation));
          return correlation;
        });
    resolveExact.then(function (exact) {
      if (!exact.runId || !exact.projectId || !exact.repositoryIdentity) { reportItem = null; return; }
      var query = new URLSearchParams({ projectId: exact.projectId, repositoryIdentity: exact.repositoryIdentity, runId: exact.runId });
      return request('/api/tasks/result?' + query.toString()).then(function (body) {
        reportItem = body.item || null;
        var marker = reportItem && reportMarker(reportItem);
        if (reportItem) show(localStorage.getItem(marker) ? '运行报告已插入原始对话' : '运行报告已就绪 · Run ID: ' + ((reportItem.report && reportItem.report.runId) || reportItem.runId || 'ABSENT'), 'SUCCESS');
      });
    }).catch(function () { show('暂时无法读取运行结果，请稍后重试。', 'ERROR'); });
  }
  async function insert() {
    if (!reportItem) return show('暂无匹配的 AICC_RUN_REPORT_V1。', 'BLOCKED');
    var raw = localStorage.getItem(key); var correlation; try { correlation = raw ? JSON.parse(raw) : null; } catch (_) { correlation = null; }
    var reportRunId = reportItem.runId || (reportItem.report && reportItem.report.runId);
    var marker = reportMarker(reportItem);
    if (localStorage.getItem(marker)) return show('运行报告已插入原始对话。', 'SUCCESS');
    if (!correlation || correlation.sourceReference !== location.href || !correlation.originContext || correlation.originContext.conversationId !== currentConversationId()) return show('请返回原始 ChatGPT 对话后插入运行报告。', 'BLOCKED');
    var lock = lockPrefix + marker;
    var lockValue = localStorage.getItem(lock);
    if (lockValue) { try { if (Date.now() < JSON.parse(lockValue).expiresAt) return show('运行报告正在插入原始对话。', 'SUCCESS'); } catch (_) {} }
    var owner = String(Date.now()) + ':' + Math.random();
    localStorage.setItem(lock, JSON.stringify({ owner: owner, expiresAt: Date.now() + 15000 }));
    if (JSON.parse(localStorage.getItem(lock)).owner !== owner) return show('运行报告正在插入原始对话。', 'SUCCESS');
    var report = reportItem.report || {};
    var text = ['AICC_RUN_REPORT_V1', 'Run ID: ' + (report.runId || reportItem.runId || 'ABSENT'), 'Entity: ' + (report.entityId || 'ABSENT'), 'Execution type: ' + (report.executionType || 'UNAVAILABLE'), '', 'Runtime Result: ' + (report.runtimeResult || 'UNAVAILABLE'), 'Gate Result: ' + (report.gateResult || 'UNAVAILABLE'), '', 'Summary:', (report.summary || 'UNAVAILABLE')].join('\n');
    var target = composer(); if (!target) { localStorage.removeItem(lock); return show('找不到 ChatGPT 当前编辑框。请使用复制回退。', 'ERROR'); }
    if (window.AICCChatGPTDom.reportFormatPresent(target, text)) { localStorage.setItem(marker, '1'); localStorage.removeItem(lock); acknowledge(reportItem); return show('运行报告已插入原始对话。', 'SUCCESS'); }
    var inserted = window.AICCChatGPTDom.insertTextIntoComposer(target, text);
    if (!inserted || !(await window.AICCChatGPTDom.verifyComposerText(target, text))) { localStorage.removeItem(lock); return show('运行报告插入失败：ChatGPT 编辑器未保留报告格式。', 'ERROR'); }
    localStorage.setItem(marker, '1'); localStorage.removeItem(lock); acknowledge(reportItem);
    show('运行报告已插入编辑框，请由 Owner 手动发送。', 'SUCCESS');
  }
  function mount() {
    if (document.querySelector('[data-aicc-gpt-bridge]')) return;
    panel = document.createElement('aside'); panel.dataset.aiccGptBridge = 'true';
    panel.innerHTML = '<strong>AICC Bridge</strong><button data-aicc-send>发送到 AICC</button><button data-aicc-insert>插入运行报告</button><div data-aicc-status>等待 Owner 操作</div>';
    panel.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;display:grid;gap:7px;width:220px;padding:12px;border:1px solid #d8dee8;border-radius:10px;background:#fff;box-shadow:0 8px 28px #0002;font:13px system-ui;color:#1f2937';
    document.body.appendChild(panel); panel.querySelector('[data-aicc-send]').addEventListener('click', send); panel.querySelector('[data-aicc-insert]').addEventListener('click', insert); poll(); scanLocalSync();
  }
  if (document.body) { mount(); mountNativeActions(); } else new MutationObserver(mount).observe(document.documentElement, { childList: true });
  setInterval(mountNativeActions, 1000);
  setInterval(function () { poll(); scanLocalSync(); }, 3000);
}());
