(function () {
  'use strict';
  try { console.log('[AICC_RUNTIME_PATH_DIAG] CONTENT_SCRIPT_BOOT'); console.log('[AICC_RUNTIME_PATH_DIAG] FILE=web-adapter/chrome-extension-current/content.js'); globalThis.__AICC_RUNTIME_PATH_DIAG__ = { file: 'web-adapter/chrome-extension-current/content.js', bootTimestamp: new Date().toISOString(), composerMountFunction: 'window.AICCChatGPTDom.mountComposerAiccAction' }; } catch { /* diagnostic only */ }
  if (window.__AICC_GPT_BRIDGE_EXTENSION__) return;
  window.__AICC_GPT_BRIDGE_EXTENSION__ = true;

  const SELECTORS = Object.freeze({
    mount: '[data-aicc-gpt-bridge-extension]',
    status: '[data-aicc-status]',
    runtimePanel: '[data-aicc-runtime-result-panel]',
    runtimeStatus: '[data-aicc-runtime-status]',
    runtimeSource: '[data-aicc-runtime-source]',
    runtimeRunProfile: '[data-aicc-runtime-run-profile]',
    runtimeRunId: '[data-aicc-runtime-run-id]',
    runtimeExecutionId: '[data-aicc-runtime-execution-id]',
    runtimeExecution: '[data-aicc-runtime-execution]',
    runtimeResult: '[data-aicc-runtime-result]',
    runtimeGptReturn: '[data-aicc-runtime-gpt-return]',
    runtimeUpdated: '[data-aicc-runtime-updated]',
    runtimeError: '[data-aicc-runtime-error]',
    resultPreview: '[data-aicc-result-preview]',
    resultActions: '[data-aicc-result-actions]',
    copyResult: '[data-aicc-copy-result]',
    expandResult: '[data-aicc-expand-result]',
    insertGpt: '[data-aicc-insert-gpt]',
    collapse: '[data-aicc-collapse]',
    handle: '[data-aicc-expand-handle]'
  });
  let panel;
  let panelExpanded = true;
  let reportItem = null;
  let reportCorrelation = null;
  let explicitPayloadBinding = null;
  let inboundClipboardBinding = null;
  let returnInFlight = false;
  let clipboardExecutionInFlight = false;
  let usClaudeInFlight = false;
  let usClaudeAvailable = true;
  let usClaudeReason = 'US-WAREHOUSE-01 unreachable';
  let usClaudeCapabilityInFlight = false;
  let clipboardChatGptSendInFlight = false;
  let codexExecutionInFlight = false;
  let codexResultInFlight = false;
  let insertGptInFlight = false;
  const attemptedGptResultIds = new Set();
  const submittedGptResultIds = new Set();
  let nextStepInFlight = false;
  let panelResultInFlight = false;
  let resultExpanded = false;
  let runtimeAttemptUnbound = false;
  let lastErrorSignature = '';
  const AICC_DECISION_AUTHORITY = 0;
  const CODEX_EXECUTION_RESULT = 'AICC_EXECUTION_RESULT_V1';
  const RESULT_INSERT_STATUS_KEY = 'aicc-result-insert-status-v1';
  const RUNTIME_PROJECTION_KEY = 'aicc-bridge-runtime-projection-v1';
  const PENDING_SUBMISSION_KEY = 'aicc-gpt-bridge-pending-submission-v1';
  const ResultInsertStatus = Object.freeze({ READY: 'READY', COPYING: 'COPYING', COPIED: 'COPIED', INSERTING: 'INSERTING', INSERTED: 'INSERTED', COPY_ONLY_FAILED: 'COPY_ONLY_FAILED' });
  let resultInsertStatus = { status: ResultInsertStatus.READY, runId: null, resultId: null, resultSource: null };
  let runtimeProjection = window.AICCChatGPTDom.emptyBridgeRuntimeProjection();
  const attemptedReturnIds = new Set();
  const insertedResultIds = new Set();
  const AUTO_REPORT_INSERT_DEFAULT = false;
  const SUBMISSION_ACK_TIMEOUT_MS = 8000;
  let submissionReconciliationInFlight = false;
  let autoLoop = { loop: null, status: null, control_loop_state: null, global_feedback: null, expected_turn: null };
  let autoLoopFeedbackInFlight = false;
  let autoLoopControlInFlight = false;
  const consumedAssistantIds = new Set();
  const capturedBugProtocolKeys = new Set();
  const localSyncForwardStates = new Map();

  function composer() { return window.AICCChatGPTDom.resolveCanonicalChatGPTComposer(document); }
  function setStatus(message, state) { const status = panel?.querySelector(SELECTORS.status); if (status) { status.hidden = false; status.textContent = message; status.dataset.aiccState = state; } }
  function clearStatus() { const status = panel?.querySelector(SELECTORS.status); if (status) { status.hidden = true; status.textContent = ''; status.dataset.aiccState = ''; } }
  function showError(error) { const code = error?.code || 'WEB_ADAPTER_ERROR'; const reason = error?.reason || error?.message || '适配器操作失败。'; const signature = `${code}:${reason}`; if (signature === lastErrorSignature) return; lastErrorSignature = signature; if (code === 'EXTENSION_CONTEXT_INVALIDATED') return setStatus('SUBMISSION FAILED · BRIDGE\nExtension context invalidated.\n刷新当前 ChatGPT 页面后重试。', 'ERROR'); setStatus(`${code} · ${reason}`, 'ERROR'); }
  function extensionContextUsable() { try { return Boolean(chrome?.runtime?.id && typeof chrome.runtime.sendMessage === 'function'); } catch { return false; } }
  function message(type, data = {}) { return new Promise((resolve, reject) => { const invalidated = { code: 'EXTENSION_CONTEXT_INVALIDATED', reason: 'Extension context invalidated.' }; const fail = error => ({ ...invalidated, reason: error?.message || invalidated.reason }); if (!extensionContextUsable()) return reject(fail()); let settled = false; const finish = (callback, value) => { if (settled) return; settled = true; callback(value); }; try { const pending = chrome.runtime.sendMessage({ type, ...data }, response => { const runtimeError = chrome.runtime.lastError; if (runtimeError) return finish(reject, fail(runtimeError)); finish(resolve, response); }); if (pending?.catch) pending.catch(error => finish(reject, fail(error))); } catch (error) { finish(reject, fail(error)); } }); }
  function explicitBugCaptureBlocks(text) { return [...String(text || '').matchAll(/(?:^|\n)(AICC_BUG_CAPTURE_V1\n[\s\S]*?\nEND_AICC_BUG_CAPTURE_V1)(?=\n|$)/g)].map(match => match[1]); }
  function explicitLocalSyncBlocks(text) { return [...String(text || '').matchAll(/(?:^|\n)(AICC_BUG_REGISTRY_LOCAL_SYNC_V1\n[\s\S]*?\nEND_AICC_BUG_REGISTRY_LOCAL_SYNC_V1)(?=\n|$)/g)].map(match => match[1]); }
  function localSyncPayload(text) { const value = key => text.match(new RegExp(`(?:^|\\n)${key}:\\s*([^\\n]+)`))?.[1]?.trim() || ''; const payload={repository:value('REPOSITORY'),branch:value('BRANCH'),registryPath:value('REGISTRY_PATH'),sourceCommitSha:value('SOURCE_COMMIT_SHA'),action:value('ACTION')}; return payload.repository==='beyourlovercom/aicontrolcenter'&&payload.branch==='rebuild/aicc-v2'&&payload.registryPath==='docs/80_Bug_Record/01_bug_record.md'&&/^[a-f0-9]{40}$/i.test(payload.sourceCommitSha)&&payload.action==='SYNC'?payload:null; }
  async function captureExplicitBugProtocols() {
    if (!extensionContextUsable() || !window.AICCChatGPTDom?.assistantMessages) return;
    const messages = window.AICCChatGPTDom.assistantMessages(document);
    for (let index = 0; index < messages.length; index += 1) {
      const assistant = messages[index];
      const origin = window.AICCChatGPTDom.originContext(document, assistant);
      const messageId = origin.messageId || window.AICCChatGPTDom.assistantMessageIdentity(assistant, index);
      const originContext = { ...origin, messageId };
      for (const payload of explicitBugCaptureBlocks(window.AICCChatGPTDom.textOf(assistant))) {
        const key = `${messageId}:${payload}`;
        if (capturedBugProtocolKeys.has(key)) continue;
        capturedBugProtocolKeys.add(key);
        try {
          const response = await message('BUG_CAPTURE', { payload, originContext });
          if (!response?.ok) throw response?.error || { code: 'BUG_CAPTURE_FAILED', reason: 'AICC Bug Capture 未完成。' };
          const result = response.result;
          setStatus(`BUG CAPTURE · ${result?.result || 'FAILED'} · ${result?.bugId || 'NOT_ASSIGNED'}`, result?.result === 'FAILED' ? 'ERROR' : 'SUCCESS');
        } catch (error) { showError(error); }
      }
    }
  }
  async function captureExplicitLocalSyncProtocols() {
    if (!extensionContextUsable() || !window.AICCChatGPTDom?.assistantMessages) return;
    const messages = window.AICCChatGPTDom.assistantMessages(document);
    for (let index = 0; index < messages.length; index += 1) for (const block of explicitLocalSyncBlocks(window.AICCChatGPTDom.textOf(messages[index]))) { const payload=localSyncPayload(block); if(!payload) continue; const key=`${payload.sourceCommitSha}|${payload.registryPath}`, state=localSyncForwardStates.get(key); if(state==='FORWARDING'||state==='FORWARDED') continue; localSyncForwardStates.set(key,'FORWARDING'); try { const response=await message('BUG_REGISTRY_LOCAL_SYNC',{payload}); if(!response?.ok)throw response?.error||{code:'LOCAL_SYNC_FAILED',reason:'AICC Local Sync 未完成。'}; const result=response.result?.result; if(result!=='SYNCED'&&result!=='ALREADY_SYNCED')throw {code:'LOCAL_SYNC_NOT_ACCEPTED',reason:`AICC Local Sync 返回 ${result||'UNKNOWN'}`}; localSyncForwardStates.set(key,'FORWARDED'); setStatus(`BUG REGISTRY · ${result}`,'SUCCESS'); } catch(error){ localSyncForwardStates.delete(key); showError(error); } }
  }
  function boundedMessage(type, data = {}, timeoutMs = SUBMISSION_ACK_TIMEOUT_MS) { return Promise.race([message(type, data), new Promise((_, reject) => setTimeout(() => reject({ code: 'SUBMISSION_STALLED', reason: 'AICC durable acknowledgement was not received within the submission window.' }), timeoutMs))]); }
  function panelStorage() { return chrome?.storage?.local || null; }
  function storageValue(key) { return new Promise(resolve => panelStorage()?.get?.([key], result => resolve(result?.[key] || null)) ?? resolve(null)); }
  function persistStorage(key, value) { return new Promise(resolve => panelStorage()?.set?.({ [key]: value }, resolve) ?? resolve()); }
  async function pendingSubmissionFor(text, submissionId, sourceType, originContext) {
    const payloadHash = await window.AICCChatGPTDom.submissionPayloadHash(text);
    return { submission_id: submissionId, instruction_id: submissionId, payload_hash: payloadHash, source: sourceType, ...(originContext?.conversationId ? { conversation_id: originContext.conversationId } : {}), source_reference: location.href, origin_context: originContext, created_at: new Date().toISOString(), ack_state: 'PENDING' };
  }
  async function reconcilePendingSubmission(pending) {
    if (submissionReconciliationInFlight) return null;
    const candidate = pending || await storageValue(PENDING_SUBMISSION_KEY);
    if (!candidate?.submission_id) return null;
    submissionReconciliationInFlight = true;
    try {
      const result = await message('RECONCILE_SUBMISSION', { pending: candidate });
      if (!result?.ok || !result.reconciled || !result.item || !result.correlation) return null;
      reportItem = result.item?.item || result.item;
      reportCorrelation = result.correlation;
      runtimeAttemptUnbound = false;
      const identity = window.AICCChatGPTDom.durableAck(result.inbox || result.item) || { submissionId: result.correlation.submissionId, instructionId: result.correlation.instructionId, taskId: result.correlation.taskId, executionId: result.correlation.executionId, runId: result.correlation.runId };
      const nextState = identity.executionId && identity.runId ? 'RUN_CREATED' : 'AICC_ACCEPTED';
      updateRuntimeProjection({ transition: nextState, correlation: reportCorrelation, item: reportItem, sourceType: candidate.source, runId: identity.runId, executionId: identity.executionId, error: null, updatedAt: reportItem?.updatedAt || new Date().toISOString() });
      return result;
    } catch { return null; }
    finally { submissionReconciliationInFlight = false; }
  }
  function formatUpdatedAt(value) { const elapsed = Date.now() - Date.parse(value || ''); if (!Number.isFinite(elapsed) || elapsed < 0) return value || ''; if (elapsed < 60_000) return 'Just now'; if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} min ago`; return new Date(value).toLocaleString(); }
  function sourceDisplayLabel(source) { return source === 'CLIPBOARD_DIRECT' ? '剪贴板' : source || ''; }
  function runProfileLabel(projection) {
    if (!projection.model) return '';
    const model = modelCapability(projection.model)?.displayName || projection.model;
    const reasoning = effortLabels[projection.reasoningEffort] || projection.reasoningEffort;
    return reasoning ? `${model} · ${reasoning}` : model;
  }
  function resultLabel(projection) { if (projection.resultState === 'AVAILABLE' && projection.runId && projection.resultText.trim()) return 'Available'; return projection.status === 'FAILED' ? 'Unavailable' : 'Waiting'; }
  function renderOptionalRuntimeField(section, selector, value, title = value) {
    const node = section.querySelector(selector); if (!node) return;
    const visible = Boolean(value); const row = node.closest('[data-aicc-runtime-row]');
    node.textContent = visible ? value : ''; node.title = visible && title ? title : '';
    if (row) row.hidden = !visible;
  }
  function executionLabel(projection) {
    const runtime = projection.source === 'AICC' ? 'AICC runtime' : 'Codex';
    if (projection.status === 'SUBMITTING_LOCAL') return `${runtime} submitting locally`;
    if (projection.status === 'TRANSPORT_SENT') return `${runtime} transport sent`;
    if (projection.status === 'AICC_ACCEPTED') return 'AICC accepted';
    if (projection.status === 'RUN_CREATED') return 'AICC Run created';
    if (projection.status === 'RUNNING') return `${runtime} running`;
    if (projection.status === 'COMPLETED') return `${runtime} finished`;
    if (projection.status === 'FAILED') return `${runtime} failed`;
    return '';
  }
  function renderRuntimeProjection() {
    const section = panel?.querySelector(SELECTORS.runtimePanel); if (!section) return;
    const idle = runtimeProjection.status === 'IDLE';
    section.dataset.aiccRuntimeState = runtimeProjection.status;
    section.dataset.aiccResultState = runtimeProjection.resultState;
    section.dataset.aiccResultExpanded = String(resultExpanded);
    const values = [[SELECTORS.runtimeStatus, runtimeProjection.status], [SELECTORS.runtimeSource, idle ? '' : sourceDisplayLabel(runtimeProjection.source)], [SELECTORS.runtimeExecution, executionLabel(runtimeProjection)], [SELECTORS.runtimeResult, idle ? '' : resultLabel(runtimeProjection)], [SELECTORS.runtimeUpdated, idle ? '' : formatUpdatedAt(runtimeProjection.updatedAt)]];
    values.forEach(([selector, value]) => { const node = section.querySelector(selector); if (node) node.textContent = value; });
    const runtimeMessage = section.querySelector(SELECTORS.runtimeError);
    if (runtimeMessage && runtimeProjection.error) { runtimeMessage.hidden = false; runtimeMessage.textContent = runtimeProjection.error; runtimeMessage.dataset.aiccState = 'ERROR'; runtimeMessage.dataset.aiccStatusSource = 'RUNTIME'; }
    else if (runtimeMessage?.dataset.aiccStatusSource === 'RUNTIME') { runtimeMessage.hidden = true; runtimeMessage.textContent = ''; runtimeMessage.dataset.aiccState = ''; runtimeMessage.dataset.aiccStatusSource = ''; }
    renderOptionalRuntimeField(section, SELECTORS.runtimeRunProfile, idle ? '' : runProfileLabel(runtimeProjection));
    renderOptionalRuntimeField(section, SELECTORS.runtimeRunId, idle ? '' : runtimeProjection.runId || '', runtimeProjection.runId || '');
    renderOptionalRuntimeField(section, SELECTORS.runtimeExecutionId, idle ? '' : runtimeProjection.executionId || '', runtimeProjection.executionId || '');
    const preview = section.querySelector(SELECTORS.resultPreview); if (preview) preview.textContent = runtimeProjection.resultText || '';
    const resultAvailable = runtimeProjection.resultState === 'AVAILABLE' && Boolean(runtimeProjection.runId && runtimeProjection.resultText.trim());
    const actions = section.querySelector(SELECTORS.resultActions); if (actions) actions.hidden = !resultAvailable;
    const copy = section.querySelector(SELECTORS.copyResult); if (copy) copy.disabled = panelResultInFlight || !resultAvailable;
    const expand = section.querySelector(SELECTORS.expandResult); if (expand) { expand.disabled = !resultAvailable; const label = expand.querySelector('[data-aicc-footer-label]'); if (label) label.textContent = resultExpanded ? '收起结果' : '展开结果'; }
    const insertGpt = section.querySelector(SELECTORS.insertGpt);
    if (insertGpt) {
      const resultId = runtimeProjection.resultId || runtimeProjection.resultHash || runtimeProjection.runId || '';
      const disabledReason = !resultAvailable ? '当前没有可用的最新结果预览。' : insertGptInFlight ? '正在插入并发送当前结果，请等待完成。' : attemptedGptResultIds.has(resultId) ? '当前结果已尝试发送，不会重复提交。' : '';
      insertGpt.disabled = Boolean(disabledReason);
      insertGpt.title = disabledReason ? `插入 GPT · ${disabledReason}` : '插入当前结果预览并发送到 GPT';
      insertGpt.setAttribute('aria-disabled', String(Boolean(disabledReason)));
    }
  }
  function updateRuntimeProjection(input = {}, persist = true) {
    runtimeProjection = window.AICCChatGPTDom.projectBridgeRuntime({ ...input, previous: runtimeProjection });
    renderRuntimeProjection();
    if (persist) panelStorage()?.set?.({ [RUNTIME_PROJECTION_KEY]: runtimeProjection });
    return runtimeProjection;
  }
  function setActionLabel(button, label) { const node = button?.querySelector('[data-aicc-action-label]'); if (node) node.textContent = label; else if (button) button.textContent = label; }
  function restoreRuntimeProjection(onRestored) {
    panelStorage()?.get?.([RUNTIME_PROJECTION_KEY], result => {
      const stored = result?.[RUNTIME_PROJECTION_KEY];
      if (stored && Object.values(window.AICCChatGPTDom.BridgeRuntimeState).includes(stored.status)) {
        const recovered = window.AICCChatGPTDom.recoverBridgeRuntimeProjection({ ...window.AICCChatGPTDom.emptyBridgeRuntimeProjection(), ...stored });
        runtimeProjection = recovered;
        if (recovered.status !== stored.status) panelStorage()?.set?.({ [RUNTIME_PROJECTION_KEY]: recovered });
        if (runtimeProjection.resultState === 'AVAILABLE' && (!runtimeProjection.runId || !String(runtimeProjection.resultText || '').trim())) runtimeProjection = { ...runtimeProjection, resultState: 'WAITING', resultId: null, resultHash: null, resultText: '' };
      }
      renderRuntimeProjection();
      onRestored?.();
    });
  }
  function updateResultInsertStatus(status, details = {}) {
    resultInsertStatus = { ...resultInsertStatus, ...details, status };
    const statusNode = panel?.querySelector(SELECTORS.status);
    if (statusNode) { statusNode.dataset.aiccResultInsertStatus = status; statusNode.dataset.aiccResultRunId = resultInsertStatus.runId || ''; statusNode.dataset.aiccResultId = resultInsertStatus.resultId || ''; statusNode.dataset.aiccResultSource = resultInsertStatus.resultSource || ''; }
    panelStorage()?.set?.({ [RESULT_INSERT_STATUS_KEY]: resultInsertStatus });
  }
  function restoreResultInsertStatus() { panelStorage()?.get?.([RESULT_INSERT_STATUS_KEY], result => { const stored = result?.[RESULT_INSERT_STATUS_KEY]; if (stored?.status && Object.values(ResultInsertStatus).includes(stored.status)) { resultInsertStatus = stored; const identity = `${stored.resultSource}:${stored.resultId || stored.runId || 'ABSENT'}`; if (stored.resultId && stored.status !== ResultInsertStatus.READY) attemptedReturnIds.add(stored.resultId); if (stored.status === ResultInsertStatus.INSERTED) insertedResultIds.add(identity); updateResultInsertStatus(stored.status); } }); }
  function renderPanelState() {
    if (!panel) return;
    panel.dataset.aiccPanelState = panelExpanded ? 'EXPANDED' : 'COLLAPSED';
    panel.setAttribute('aria-hidden', String(!panelExpanded));
    const collapse = panel.querySelector(SELECTORS.collapse);
    if (collapse) collapse.textContent = panelExpanded ? '‹' : '›';
    const handle = document.querySelector(SELECTORS.handle);
    if (handle) handle.hidden = panelExpanded;
  }
  function setPanelExpanded(expanded) {
    panelExpanded = Boolean(expanded); renderPanelState();
    panelStorage()?.set?.({ aiccBridgePanelCollapsed: !panelExpanded });
  }
  function restorePanelState() {
    panelStorage()?.get?.(['aiccBridgePanelCollapsed'], result => { panelExpanded = result?.aiccBridgePanelCollapsed !== true; renderPanelState(); });
  }
  function removeLegacyAutoLoopUi() {
    panel?.querySelectorAll('[data-aicc-legacy-auto-loop]').forEach(node => node.remove());
  }

  function currentConversationId() { return window.AICCChatGPTDom.originContext(document, null).conversationId; }
  function autoLoopSummaryNodes() { return { status: panel?.querySelector('[data-aicc-auto-loop-status]'), details: panel?.querySelector('[data-aicc-auto-loop-details]'), bind: panel?.querySelector('[data-aicc-auto-loop-bind]'), toggle: panel?.querySelector('[data-aicc-auto-loop-toggle]') }; }
  function renderAutoLoopProjection() {
    const nodes = autoLoopSummaryNodes();
    const status = autoLoop.status;
    if (nodes.status) nodes.status.textContent = status?.label || 'AUTO LOOP · NOT BOUND';
    if (nodes.details) nodes.details.textContent = [autoLoop.control_loop_state?.execution_status, autoLoop.control_loop_state?.feedback_delivery_status, autoLoop.control_loop_state?.control_loop_status, autoLoop.expected_turn?.expected_gpt_turn_id].filter(Boolean).join(' · ');
    const bound = Boolean(autoLoop.loop?.binding_active === true && autoLoop.loop?.conversation_id === currentConversationId());
    if (nodes.bind) nodes.bind.checked = bound;
    if (nodes.toggle) { nodes.toggle.disabled = !bound; nodes.toggle.checked = bound && autoLoop.loop?.enabled === true; }
  }
  async function refreshAutoLoopStatus() {
    const conversation_id = currentConversationId();
    if (!conversation_id) return null;
    const value = await message('AUTO_LOOP_STATUS', { conversation_id });
    if (!value?.ok) return value;
    autoLoop = value;
    renderAutoLoopProjection();
    return value;
  }
  function exactMessageId(message) { return window.AICCChatGPTDom.assistantMessageIdentity(message, window.AICCChatGPTDom.assistantMessages(document).indexOf(message)); }
  function orderedChatMessages() {
    const messages = [...window.AICCChatGPTDom.userMessages(document), ...window.AICCChatGPTDom.assistantMessages(document)];
    return [...new Set(messages)].sort((left, right) => {
      if (left === right) return 0;
      const relation = left.compareDocumentPosition?.(right);
      return relation & 4 ? -1 : relation & 2 ? 1 : 0;
    });
  }
  function followsExpectedFeedbackTurn(message, expectedTurn) {
    if (!message || !expectedTurn?.feedback_message_id) return false;
    const ordered = orderedChatMessages();
    const assistantIndex = ordered.indexOf(message);
    if (assistantIndex < 1) return false;
    const user = ordered[assistantIndex - 1];
    return window.AICCChatGPTDom.userMessageIdentity(user, window.AICCChatGPTDom.userMessages(document).indexOf(user)) === expectedTurn.feedback_message_id;
  }
  function expectedAssistantCandidates(expectedTurn) {
    return window.AICCChatGPTDom.assistantMessages(document).filter(message => followsExpectedFeedbackTurn(message, expectedTurn) && String(window.AICCChatGPTDom.textOf(message) || '').trim());
  }
  async function bindCurrentConversation() {
    const conversation_id = currentConversationId();
    if (!conversation_id) return;
    const visible_assistant_controls = window.AICCChatGPTDom.assistantMessages(document).map((message, index) => ({ assistant_message_id: window.AICCChatGPTDom.assistantMessageIdentity(message, index), response: String(window.AICCChatGPTDom.textOf(message) || '') })).filter(item => item.response.trim());
    const result = await message('AUTO_LOOP_BIND', { conversation_id, formal_wp_id: 'AICC-V2-GPT-CODEX-BRIDGE-001', visible_assistant_controls });
    if (!result?.ok) return showError(result?.error);
    await refreshAutoLoopStatus();
  }
  async function unlockCurrentConversation() {
    if (!autoLoop.loop?.control_loop_id) return;
    const result = await message('AUTO_LOOP_UNBIND', { control_loop_id: autoLoop.loop.control_loop_id });
    if (!result?.ok) return showError(result?.error);
    await refreshAutoLoopStatus();
  }
  async function handleConversationLockChange(event) {
    if (event.target.checked) await bindCurrentConversation();
    else await unlockCurrentConversation();
  }
  async function handleAutoLoopModeChange(event) {
    if (!autoLoop.loop?.control_loop_id) return;
    const result = await message('AUTO_LOOP_MODE', { control_loop_id: autoLoop.loop.control_loop_id, enabled: Boolean(event.target.checked) });
    if (!result?.ok) { event.target.checked = !event.target.checked; return showError(result?.error); }
    await refreshAutoLoopStatus();
  }
  async function submitAutomaticFeedback() {
    if (autoLoopFeedbackInFlight || !autoLoop.loop?.enabled || !autoLoop.loop?.binding_active) return null;
    const loop = autoLoop.loop;
    const canonicalResult = codexExecutionResult(reportItem);
    const runId = reportItem?.report?.runId || reportItem?.runId;
    if (!canonicalResult?.rawResult || !runId || loop.run_id !== runId) return null;
    if (['WAITING_OWNER_UAT', 'BLOCKED', 'COMPLETE', 'PAUSED'].includes(loop.status)) return null;
    if (autoLoop.expected_turn && ['PENDING', 'GPT_CONTROL_RECEIVED', 'SUBMITTING_AICC'].includes(autoLoop.expected_turn.state)) return null;
    autoLoopFeedbackInFlight = true;
    let deliveryRetryAttempt = 0;
    try {
      while (true) {
        let claimedFeedbackKey = '';
        try {
          const claimed = await message('AUTO_LOOP_FEEDBACK', { control_loop_id: loop.control_loop_id, formal_wp_id: loop.formal_wp_id, conversation_id: loop.conversation_id, binding_epoch: loop.binding_epoch, execution_id: canonicalResult.executionId || reportItem.executionId, run_id: runId, result_id: canonicalResult.resultId, result_hash: canonicalResult.resultHash, execution_result: canonicalResult.rawResult, model: reportItem?.report?.model || reportItem?.model });
          if (!claimed?.ok || !claimed.record) return claimed;
          const feedback = claimed.record;
          claimedFeedbackKey = feedback.feedback_key;
          if (!claimed.claimGranted && feedback.lifecycle !== 'FEEDBACK_CLAIMED') { await refreshAutoLoopStatus(); return claimed; }
          const inserting = await message('AUTO_LOOP_FEEDBACK_STATE', { operation: 'inserting', control_loop_id: loop.control_loop_id, feedback_key: feedback.feedback_key });
          if (!inserting?.ok || inserting.attemptGranted === false) return inserting;
          const submission = await window.AICCChatGPTDom.submitChatGPTComposerOnce({ document, conversationId: loop.conversation_id, payload: feedback.envelope, submissionId: feedback.feedback_id, afterInsert: async () => { const result = await message('AUTO_LOOP_FEEDBACK_STATE', { operation: 'inserted', control_loop_id: loop.control_loop_id, feedback_key: feedback.feedback_key }); if (!result?.ok) throw new Error(result?.error?.code || 'FEEDBACK_INSERT_CONFIRMATION_FAILED'); }, beforeSubmit: async () => { const result = await message('AUTO_LOOP_FEEDBACK_STATE', { operation: 'submitting', control_loop_id: loop.control_loop_id, feedback_key: feedback.feedback_key }); if (!result?.ok || result.sendGranted === false) throw new Error(result?.error?.code || 'FEEDBACK_SEND_CLAIM_FAILED'); } });
          const submitted = await message('AUTO_LOOP_FEEDBACK_STATE', { operation: 'submitted', control_loop_id: loop.control_loop_id, feedback_key: feedback.feedback_key });
          if (!submitted?.ok) return submitted;
          const completed = await message('AUTO_LOOP_FEEDBACK_STATE', { operation: 'complete', control_loop_id: loop.control_loop_id, feedback_key: feedback.feedback_key, feedback_message_id: submission.userMessageId, conversation_id: loop.conversation_id });
          if (!completed?.ok) return completed;
          await refreshAutoLoopStatus();
          return completed;
        } catch (error) {
          if (claimedFeedbackKey) await message('AUTO_LOOP_FEEDBACK_STATE', { operation: 'fail', control_loop_id: loop.control_loop_id, feedback_key: claimedFeedbackKey, reason: error?.message || error?.code || 'FEEDBACK_DELIVERY_FAILED' }).catch(() => null);
          if (deliveryRetryAttempt < 1 && claimedFeedbackKey) {
            const retry = await message('AUTO_LOOP_FEEDBACK_STATE', { operation: 'retry', control_loop_id: loop.control_loop_id, feedback_key: claimedFeedbackKey }).catch(() => null);
            if (retry?.ok && retry.retryGranted) { deliveryRetryAttempt += 1; continue; }
          }
          showError({ code: 'FEEDBACK_DELIVERY_FAILED', reason: error?.message || '自动循环 feedback 投递失败。' });
          return { ok: false, error };
        }
      }
    } finally { autoLoopFeedbackInFlight = false; }
  }
  async function consumeNewAssistantControl() {
    if (autoLoopControlInFlight) return null;
    const status = await refreshAutoLoopStatus();
    if (!status?.ok || !status.expected_turn || !autoLoop.loop?.enabled || !autoLoop.loop?.binding_active || !['PENDING', 'GPT_CONTROL_RECEIVED', 'SUBMITTING_AICC'].includes(status.expected_turn.state)) return null;
    const candidates = expectedAssistantCandidates(status.expected_turn).filter(message => !consumedAssistantIds.has(exactMessageId(message)));
    if (candidates.length !== 1) return null;
    const messageNode = candidates[0];
    const current = { id: exactMessageId(messageNode), text: String(window.AICCChatGPTDom.textOf(messageNode) || ''), message: messageNode };
    if (!followsExpectedFeedbackTurn(current.message, status.expected_turn)) return null;
    autoLoopControlInFlight = true;
    consumedAssistantIds.add(current.id);
    try {
      const result = await message('AUTO_LOOP_CONTROL', { conversation_id: currentConversationId(), assistant_message_id: current.id, response: current.text, expected_gpt_turn_id: status.expected_turn.expected_gpt_turn_id });
      if (!result?.ok) {
        if (result?.error?.code === 'EXPECTED_FEEDBACK_TURN_CORRELATION_FAILED') {
          const recovered = await message('AUTO_LOOP_CORRELATION_RECOVER', { control_loop_id: autoLoop.loop.control_loop_id, expected_gpt_turn_id: status.expected_turn.expected_gpt_turn_id }).catch(() => null);
          if (recovered?.ok && recovered.recoveryGranted) return message('AUTO_LOOP_CONTROL', { conversation_id: currentConversationId(), assistant_message_id: current.id, response: current.text, expected_gpt_turn_id: status.expected_turn.expected_gpt_turn_id });
        }
        showError(result?.error);
        return result;
      }
      clearStatus(); lastErrorSignature = '';
      await refreshAutoLoopStatus();
      return result;
    } finally { autoLoopControlInFlight = false; }
  }
  function addPanelStyle() {
    if (document.querySelector('[data-aicc-panel-style]')) return;
    const style = document.createElement('style'); style.dataset.aiccPanelStyle = 'true';
    style.textContent = '.aicc-bridge-panel{position:fixed;right:16px;bottom:16px;z-index:2147483647;display:grid;gap:7px;width:220px;max-height:calc(100vh - 32px);overflow-x:hidden;overflow-y:auto;padding:12px;border:1px solid #d8dee8;border-radius:10px;background:#fff;box-shadow:0 8px 28px #0002;font:13px system-ui;color:#1f2937;transition:transform .16s ease,opacity .16s ease}.aicc-bridge-panel *{box-sizing:border-box;min-width:0}.aicc-bridge-panel[data-aicc-panel-state="COLLAPSED"]{transform:translateX(calc(100% + 12px));opacity:0;pointer-events:none}.aicc-bridge-panel button{max-width:100%;border-radius:7px;padding:7px 9px;font:inherit;cursor:pointer}.aicc-bridge-panel [data-aicc-action-button]{background:#172033;color:#fff;border:1px solid #172033}.aicc-bridge-panel [data-aicc-action-button]:disabled,.aicc-bridge-panel [data-aicc-send][data-aicc-payload-state="GHOST"]{background:transparent;color:#8a93a3;border-color:#cbd5e1}.aicc-bridge-panel [data-aicc-send][data-aicc-payload-state="GHOST"]{cursor:pointer}.aicc-bridge-panel [data-aicc-action-button]:disabled{cursor:not-allowed}.aicc-bridge-panel [data-aicc-collapse]{position:absolute;right:8px;top:7px;border:0;background:transparent;color:#334155;font-size:20px;line-height:1}.aicc-bridge-expand-handle{position:fixed;right:0;bottom:28px;z-index:2147483647;border:1px solid #cbd5e1;border-right:0;border-radius:8px 0 0 8px;background:#172033;color:#fff;padding:10px 7px;cursor:pointer;font:600 16px/1 system-ui}.aicc-bridge-panel [data-aicc-status]{color:#475569;line-height:1.35}.aicc-runtime-result{display:grid;gap:6px;max-width:100%;margin-top:3px;padding-top:10px;border-top:1px solid #d8dee8;overflow:hidden}.aicc-runtime-result h2{flex:0 0 auto;margin:0;font:600 13px system-ui;white-space:nowrap}.aicc-runtime-heading{display:flex;align-items:center;justify-content:space-between;gap:6px;max-width:100%;font-size:11px}.aicc-runtime-status-badge{display:inline-flex;align-items:center;gap:4px;max-width:100%;padding:2px 6px;border-radius:999px;background:#f1f5f9;color:#475569;font:600 10px/1.4 system-ui;white-space:nowrap}.aicc-runtime-status-badge::before{content:"";width:5px;height:5px;flex:0 0 auto;border-radius:50%;background:currentColor}.aicc-runtime-result[data-aicc-runtime-state="SUBMITTING"] .aicc-runtime-status-badge,.aicc-runtime-result[data-aicc-runtime-state="RUNNING"] .aicc-runtime-status-badge{background:#eff6ff;color:#2563eb}.aicc-runtime-result[data-aicc-runtime-state="COMPLETED"] .aicc-runtime-status-badge{background:#ecfdf5;color:#047857}.aicc-runtime-result[data-aicc-runtime-state="FAILED"] .aicc-runtime-status-badge{background:#fff1f2;color:#be123c}.aicc-runtime-source{overflow:hidden;color:#64748b;text-overflow:ellipsis;white-space:nowrap}.aicc-runtime-fields{display:grid;gap:3px;margin:0;font-size:11px}.aicc-runtime-row{display:grid;grid-template-columns:68px minmax(0,1fr);gap:7px;align-items:start}.aicc-runtime-row[hidden]{display:none}.aicc-runtime-fields dt{color:#64748b}.aicc-runtime-fields dd{max-width:100%;margin:0;min-width:0}.aicc-runtime-id,.aicc-runtime-profile{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.aicc-runtime-error{max-width:100%;overflow-wrap:anywhere;color:#b91c1c;white-space:pre-wrap}.aicc-result-preview-label{font-size:11px;color:#64748b}.aicc-result-preview{box-sizing:border-box;margin:0;max-width:100%;max-height:76px;overflow:hidden;padding:7px;border:1px solid #d8dee8;border-radius:7px;background:#f8fafc;color:#334155;font:11px/1.4 ui-monospace,SFMono-Regular,monospace;white-space:pre-wrap;overflow-wrap:anywhere}.aicc-runtime-result[data-aicc-result-expanded="true"] .aicc-result-preview{max-height:240px;overflow:auto}.aicc-result-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-flow:column;gap:5px;max-width:100%;white-space:nowrap}.aicc-result-actions button{padding:5px 6px;font-size:11px;white-space:nowrap}.aicc-runtime-result[data-aicc-result-state="NONE"] .aicc-runtime-details,.aicc-runtime-result[data-aicc-result-state="WAITING"] .aicc-result-preview-label,.aicc-runtime-result[data-aicc-result-state="WAITING"] .aicc-result-preview,.aicc-runtime-result[data-aicc-runtime-state="IDLE"] .aicc-runtime-details{display:none}';
    style.textContent += '.aicc-bridge-panel{--aicc-ink:#13233b;--aicc-muted:#63748d;--aicc-line:#d4dce8;--aicc-navy:#10213b;gap:12px;width:380px;max-width:calc(100vw - 24px);max-height:calc(100dvh - 32px);padding:20px;border-color:var(--aicc-line);border-radius:13px;box-shadow:0 10px 32px #0f172a24;font:15px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--aicc-ink);scrollbar-width:thin}.aicc-bridge-title{display:flex;align-items:center;justify-content:space-between;margin:0;font-size:23px;font-weight:750;letter-spacing:.01em}.aicc-bridge-panel button{font:inherit;touch-action:manipulation}.aicc-bridge-panel button:focus-visible{outline:2px solid #2376df;outline-offset:2px}.aicc-bridge-panel [data-aicc-collapse]{position:static;width:36px;height:36px;padding:0;color:var(--aicc-ink);font-size:30px}.aicc-auto-loop-summary{display:flex;align-items:center;gap:9px;color:#20324d;font-size:15px;letter-spacing:.025em;white-space:nowrap}.aicc-auto-loop-summary svg{width:19px;height:19px;flex:0 0 auto;color:#1677e8;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.aicc-auto-loop-summary [data-aicc-auto-loop-status]{overflow:hidden;text-overflow:ellipsis}.aicc-auto-loop-details:empty{display:none}.aicc-auto-loop-details{overflow:hidden;color:var(--aicc-muted);font-size:12px;text-overflow:ellipsis;white-space:nowrap}.aicc-auto-control{margin:0}.aicc-auto-control summary{margin:0 0 7px;font-size:17px;font-weight:700;cursor:pointer;list-style:none}.aicc-auto-control summary::-webkit-details-marker{display:none}.aicc-auto-control summary::before{content:"▼";display:inline-block;margin-right:8px;font-size:13px}.aicc-auto-control:not([open]) summary::before{content:"▶"}.aicc-auto-control-box{display:grid;gap:9px;padding:12px 14px;border:1px solid var(--aicc-line);border-radius:10px;background:#fff}.aicc-auto-control-box label{display:flex;align-items:center;gap:12px;font-size:15px}.aicc-auto-control-box input{width:18px;height:18px;margin:0;accent-color:#1557c0}.aicc-primary-actions{display:grid;gap:7px}.aicc-bridge-panel [data-aicc-action-button]{display:grid;grid-template-columns:28px 28px minmax(0,1fr);align-items:center;gap:10px;width:100%;height:48px;padding:0 12px;border:1px solid #172b49;border-radius:9px;background:linear-gradient(135deg,#0f2039,#162b4a);color:#fff;text-align:left;box-shadow:inset 0 1px #ffffff12}.aicc-bridge-panel [data-aicc-action-button]:hover:not(:disabled){background:#193454}.aicc-bridge-panel [data-aicc-action-button]:active:not(:disabled){background:#0b1b31}.aicc-action-number{display:grid;place-items:center;width:25px;height:25px;border-radius:50%;background:#fff;color:#17233a;font-size:13px;font-weight:750}.aicc-action-icon{display:grid;place-items:center;width:24px;height:24px}.aicc-action-icon svg{width:23px;height:23px;stroke:currentColor;stroke-width:1.9;fill:none;stroke-linecap:round;stroke-linejoin:round}.aicc-action-label{overflow:hidden;font-weight:600;text-overflow:ellipsis;white-space:nowrap}.aicc-bridge-panel [data-aicc-action-button]:disabled{background:linear-gradient(135deg,#0f2039,#162b4a);color:#fff;border-color:#172b49;cursor:not-allowed;opacity:.48}.aicc-bridge-panel [data-aicc-send][data-aicc-payload-state="GHOST"]{background:linear-gradient(135deg,#0f2039,#162b4a);color:#fff;border-color:#172b49;opacity:.72}.aicc-runtime-result{gap:10px;margin-top:0;padding-top:7px;border-top:0}.aicc-runtime-heading{gap:8px;font-size:12px}.aicc-runtime-status-badge{gap:7px;padding:6px 13px;border:1px solid #d9e3ee;border-radius:8px;font:750 13px/1 system-ui}.aicc-runtime-status-badge::before{width:8px;height:8px}.aicc-runtime-result[data-aicc-runtime-state="SUBMITTING_LOCAL"] .aicc-runtime-status-badge,.aicc-runtime-result[data-aicc-runtime-state="TRANSPORT_SENT"] .aicc-runtime-status-badge,.aicc-runtime-result[data-aicc-runtime-state="AICC_ACCEPTED"] .aicc-runtime-status-badge,.aicc-runtime-result[data-aicc-runtime-state="RUN_CREATED"] .aicc-runtime-result[data-aicc-runtime-state="RUNNING"] .aicc-runtime-status-badge{border-color:#bfdbfe}.aicc-runtime-result[data-aicc-runtime-state="COMPLETED"] .aicc-runtime-status-badge{border-color:#c9eadc;color:#07834c}.aicc-runtime-result[data-aicc-runtime-state="FAILED"] .aicc-runtime-status-badge{border-color:#fecdd3}.aicc-runtime-source{font-size:12px;text-align:right}.aicc-runtime-fields{gap:0;border:1px solid var(--aicc-line);border-radius:9px;overflow:hidden;font-size:13px}.aicc-runtime-row{grid-template-columns:118px minmax(0,1fr);gap:0;min-height:36px;align-items:stretch;border-top:1px solid #e3e8ef}.aicc-runtime-row:first-child{border-top:0}.aicc-runtime-fields dt,.aicc-runtime-fields dd{display:flex;align-items:center;margin:0;padding:7px 10px}.aicc-runtime-fields dt{border-right:1px solid #e3e8ef;color:var(--aicc-muted)}.aicc-runtime-fields dd{overflow:hidden;color:#1c2c43;text-overflow:ellipsis;white-space:nowrap}.aicc-runtime-message{max-width:100%;padding:8px 10px;border-radius:7px;background:#f8fafc;color:#526277;font-size:12px;overflow-wrap:anywhere}.aicc-runtime-message[data-aicc-state="ERROR"],.aicc-runtime-message[data-aicc-state="BLOCKED"]{background:#fff1f2;color:#b4233b}.aicc-result-preview-label{font-size:16px;font-weight:700;color:var(--aicc-ink)}.aicc-result-preview{max-height:120px;padding:11px;border-color:var(--aicc-line);border-radius:9px;color:#24354c;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre;overflow-wrap:normal}.aicc-runtime-result[data-aicc-result-expanded="true"] .aicc-result-preview{max-height:320px}.aicc-result-actions{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.aicc-result-actions [data-aicc-expand-result]{grid-column:auto}.aicc-result-actions button{display:flex;align-items:center;justify-content:center;gap:6px;min-height:42px;padding:7px 6px;border:1px solid var(--aicc-line);border-radius:8px;background:#fff;color:var(--aicc-ink);font-size:12px;font-weight:600;white-space:nowrap}.aicc-result-actions svg{width:17px;height:17px;stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round}.aicc-result-actions button:disabled{cursor:not-allowed;opacity:.45}@media(max-width:430px){.aicc-bridge-panel{right:8px;bottom:8px;width:calc(100vw - 16px);max-height:calc(100dvh - 16px);padding:16px}}@media(prefers-reduced-motion:reduce){.aicc-bridge-panel{transition:none}}';
    style.textContent += '.aicc-bridge-panel{--aicc-space-section:8px;gap:var(--aicc-space-section);padding:17px;font-size:14px;line-height:1.3}.aicc-bridge-title{font-size:19px;line-height:1.1}.aicc-bridge-panel [data-aicc-collapse]{width:30px;height:30px;font-size:27px}.aicc-auto-loop-summary{gap:7px;font-size:14px;line-height:1.2}.aicc-auto-loop-summary svg{width:17px;height:17px}.aicc-auto-control summary{margin-bottom:5px;font-size:15px;line-height:1.2}.aicc-auto-control summary::before{margin-right:7px;font-size:11px}.aicc-auto-control-box{gap:6px;padding:9px 12px}.aicc-auto-control-box label{gap:9px;font-size:14px;line-height:1.25}.aicc-auto-control-box input{width:16px;height:16px}.aicc-primary-actions{gap:5px}.aicc-bridge-panel [data-aicc-action-button]{grid-template-columns:24px 22px minmax(0,1fr);gap:8px;height:36px;padding:0 10px;border-radius:8px}.aicc-action-number{width:22px;height:22px;font-size:12px}.aicc-action-icon{width:20px;height:20px}.aicc-action-icon svg{width:20px;height:20px}.aicc-action-label{font-size:14px;font-weight:550;line-height:1}.aicc-runtime-result{gap:7px;padding-top:4px}.aicc-runtime-result h2{font-size:17px;line-height:1.2}.aicc-runtime-title{gap:8px}.aicc-runtime-title [data-aicc-codex-profile-trigger]{padding:4px 0 4px 7px;font-size:13px}.aicc-runtime-title [data-aicc-codex-profile-popover]{top:31px}.aicc-runtime-heading{gap:6px;font-size:11px;line-height:1}.aicc-runtime-status-badge{gap:6px;padding:4px 10px;font-size:12px}.aicc-runtime-status-badge::before{width:7px;height:7px}.aicc-runtime-source{max-width:50%;font-size:11px;line-height:1}.aicc-runtime-fields{font-size:12px}.aicc-runtime-row{grid-template-columns:39% minmax(0,1fr);min-height:28px}.aicc-runtime-fields dt,.aicc-runtime-fields dd{padding:4px 8px;line-height:1.2}.aicc-runtime-message{padding:6px 8px;font-size:11px}.aicc-result-preview-label{font-size:14px;line-height:1.2}.aicc-result-preview{max-height:100px;padding:8px;font-size:11px;line-height:1.45;overflow-x:auto;overflow-y:auto;scrollbar-width:thin}.aicc-runtime-result[data-aicc-result-expanded="true"] .aicc-result-preview{max-height:280px}.aicc-result-actions{gap:6px}.aicc-result-actions button{gap:5px;min-height:34px;padding:4px 5px;font-size:11px}.aicc-result-actions svg{width:15px;height:15px}.aicc-insert-gpt-footer{display:flex;justify-content:center}.aicc-insert-gpt-footer button{min-width:132px;min-height:34px;padding:4px 12px;border:1px solid var(--aicc-line);border-radius:8px;background:#fff;color:var(--aicc-ink);font-size:11px;font-weight:650}.aicc-insert-gpt-footer button:disabled{cursor:not-allowed;opacity:.45}@media(max-width:430px){.aicc-bridge-panel{padding:14px}}';
    style.textContent += '.aicc-result-actions{grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-flow:column;white-space:nowrap}.aicc-result-actions [data-aicc-expand-result]{grid-column:auto}.aicc-result-actions button{white-space:nowrap}.aicc-insert-gpt-footer{display:contents}';
    document.head?.appendChild(style);
  }
  function resolveTaskSource() { return window.AICCChatGPTDom.selectedPayload(document, window.getSelection?.()); }
  function resolveCurrentPayload() {
    if (explicitPayloadBinding) return explicitPayloadBinding;
    const target = composer();
    return target ? { text: window.AICCChatGPTDom.textOf(target), originContext: window.AICCChatGPTDom.originContext(document, null), message: null, surface: target } : null;
  }
  function isInsertableReport(item) { return item?.state === 'READY' && Boolean(item?.runId || item?.report?.runId); }
  function codexExecutionResult(item) { const result = item?.report?.canonicalResult; return result?.version === CODEX_EXECUTION_RESULT ? result : null; }
  function panelPayload() {
    if (explicitPayloadBinding?.text && String(explicitPayloadBinding.text).trim()) return { ...explicitPayloadBinding, source: '已选指令' };
    if (inboundClipboardBinding?.text && String(inboundClipboardBinding.text).trim()) return { ...inboundClipboardBinding, source: '剪贴板' };
    return null;
  }
  function syncSendButton() { syncActionButtons(); }
  function actionCapabilityState(actionKey) {
    if (actionKey === 'us-claude') return { enabled: usClaudeAvailable && !usClaudeInFlight, disabledReason: usClaudeInFlight ? 'US_CLAUDE_EXECUTION_IN_FLIGHT' : usClaudeReason };
    if (actionKey === 'clipboard-codex-execute') return { enabled: !clipboardExecutionInFlight, disabledReason: 'CLIPBOARD_EXECUTION_IN_FLIGHT' };
    if (actionKey === 'codex-execute') return { enabled: !codexExecutionInFlight && Boolean(resolveCurrentPayload()?.text), disabledReason: 'TARGET_NOT_FOUND' };
    if (actionKey === 'codex-result') return { enabled: !codexResultInFlight && !panelResultInFlight && Boolean(codexExecutionResult(reportItem)?.rawResult), disabledReason: 'CODEX_RESULT_NOT_READY' };
    if (actionKey === 'aicc-send') return { enabled: true, disabledReason: '' };
    const target = composer();
    const sendButton = window.AICCChatGPTDom.findComposerSendButton(document, target);
    return { enabled: !nextStepInFlight && Boolean(target && sendButton && !sendButton.disabled), disabledReason: 'COMPOSER_SEND_NOT_READY' };
  }
  function currentActionRegistry() {
    return window.AICCBridgeActionRegistry.createBridgeActionRegistry({
      handlers: {
        'us-claude': executeUsClaude,
        'clipboard-codex-execute': executeClipboardWithCodex,
        'codex-execute': executeCurrentWithCodex,
        'codex-result': insertCodexResult,
        'aicc-send': sendInstruction,
        'next-step': executeNextStep
      },
      capabilityResolver: actionCapabilityState
    });
  }
  function syncActionButtons() {
    if (!panel) return;
    const registry = currentActionRegistry();
    panel.querySelectorAll('[data-aicc-action-button]').forEach(button => {
      const action = registry[button.dataset.aiccActionKey];
      if (!action) throw new Error(`RENDERED_ACTION_NOT_REGISTERED:${button.dataset.aiccActionKey}`);
      const disabled = !action.enabled;
      const title = action.enabled ? action.label : `${action.label} · ${action.disabledReason}`;
      const label = action.enabled ? action.label : (action.actionKey === 'codex-result' && codexResultInFlight ? 'Codex 结果处理中…' : action.label);
      if (button.disabled !== disabled) button.disabled = disabled;
      if (button.getAttribute('aria-disabled') !== String(disabled)) button.setAttribute('aria-disabled', String(disabled));
      if (button.title !== title) button.title = title;
      if (button.querySelector('[data-aicc-action-label]')?.textContent !== label) setActionLabel(button, label);
    });
  }
  function refreshExplicitPayloadBinding() {
    explicitPayloadBinding = resolveTaskSource();
    syncSendButton();
    return explicitPayloadBinding;
  }
  async function refreshUsClaudeCapability() {
    if (usClaudeCapabilityInFlight) return;
    usClaudeCapabilityInFlight = true;
    try {
      const result = await message('REMOTE_CLAUDE_STATUS');
      usClaudeAvailable = Boolean(result?.ok && result.reachable);
      usClaudeReason = result?.reason || 'US-WAREHOUSE-01 unreachable';
    } catch { usClaudeAvailable = false; usClaudeReason = 'US-WAREHOUSE-01 unreachable'; }
    finally { usClaudeCapabilityInFlight = false; syncActionButtons(); }
  }
  async function readInboundClipboard() {
    if (!navigator.clipboard?.readText) throw { code: 'CLIPBOARD_READ_UNAVAILABLE', reason: '浏览器未提供剪贴板读取能力。' };
    let text;
    try { text = await navigator.clipboard.readText(); }
    catch { throw { code: 'CLIPBOARD_READ_DENIED', reason: '无法读取剪贴板；请允许剪贴板访问后重试。' }; }
    if (!String(text || '').trim()) throw { code: 'CLIPBOARD_TEXT_REQUIRED', reason: '剪贴板中没有可发送的文本。' };
    inboundClipboardBinding = { text: String(text), originContext: window.AICCChatGPTDom.originContext(document, null), source: '剪贴板' };
    syncSendButton();
    return inboundClipboardBinding;
  }
  function isExactOriginConversation() { const current = window.AICCChatGPTDom.originContext(document, null); return Boolean(reportCorrelation?.sourceReference === location.href && reportCorrelation?.originContext?.conversationId === current.conversationId); }
  function bindPanelControl(selector, handler) {
    const button = panel?.querySelector(selector);
    if (!button || button.dataset.aiccBound === 'true') return;
    button.addEventListener('click', handler);
    button.dataset.aiccBound = 'true';
  }
  function ensurePanelActions() {
    if (!panel) return;
    const stack = panel.querySelector('.aicc-primary-actions');
    if (!stack) return;
    const registry = currentActionRegistry();
    const visibleActions = Object.values(registry).filter(action => action.visible).sort((a, b) => a.displayOrdinal - b.displayOrdinal);
    const signature = visibleActions.map(action => `${action.actionKey}:${action.displayOrdinal}`).join('|');
    if (stack.dataset.aiccActionSignature !== signature) {
      stack.innerHTML = visibleActions.map(window.AICCBridgeActionRegistry.renderBridgeAction).join('');
      stack.dataset.aiccActionSignature = signature;
    }
    if (stack.dataset.aiccRegistryBound !== 'true') {
      stack.addEventListener('click', event => {
        const button = event.target.closest?.('[data-aicc-action-button]');
        if (!button || button.disabled) return;
        const action = currentActionRegistry()[button.dataset.aiccActionKey];
        if (!action) throw new Error(`RENDERED_ACTION_NOT_REGISTERED:${button.dataset.aiccActionKey}`);
        if (typeof action.handler !== 'function') throw new Error(`VISIBLE_ACTION_WITHOUT_HANDLER:${action.actionKey}`);
        action.handler(event);
      });
      stack.dataset.aiccRegistryBound = 'true';
    }
    syncActionButtons();
  }
  function ensureAutoLoopSetup() {
    if (!panel) return;
    let setup = panel.querySelector('[data-aicc-auto-loop-setup]');
    if (!setup) {
      setup = document.createElement('details'); setup.dataset.aiccAutoLoopSetup = 'true'; setup.open = true; setup.innerHTML = '<summary>自动控制</summary><div class="aicc-auto-control-box"><label><input type="checkbox" data-aicc-auto-loop-bind> 锁定 GPT 聊天口</label><label><input type="checkbox" data-aicc-auto-loop-toggle disabled> 开启自动循环</label></div>'; panel.insertBefore(setup, panel.querySelector('.aicc-primary-actions'));
    }
    const bind = setup.querySelector('[data-aicc-auto-loop-bind]');
    const toggle = setup.querySelector('[data-aicc-auto-loop-toggle]');
    if (bind && bind.dataset.aiccBound !== 'true') { bind.addEventListener('change', handleConversationLockChange); bind.dataset.aiccBound = 'true'; }
    if (toggle && toggle.dataset.aiccBound !== 'true') { toggle.addEventListener('change', handleAutoLoopModeChange); toggle.dataset.aiccBound = 'true'; }
    renderAutoLoopProjection();
  }
  function ensureRuntimeResultPanel() {
    if (!panel) return;
    let section = panel.querySelector(SELECTORS.runtimePanel);
    if (!section) {
      section = document.createElement('section');
      section.className = 'aicc-runtime-result';
      section.dataset.aiccRuntimeResultPanel = 'true';
      section.innerHTML = '<div class="aicc-runtime-heading"><strong class="aicc-runtime-status-badge" data-aicc-runtime-status>IDLE</strong><span class="aicc-runtime-source" data-aicc-runtime-source></span></div><div class="aicc-runtime-message" data-aicc-status data-aicc-runtime-error aria-live="polite" hidden></div><dl class="aicc-runtime-fields aicc-runtime-details"><div class="aicc-runtime-row" data-aicc-runtime-row="run-profile" hidden><dt>Run Profile</dt><dd class="aicc-runtime-profile" data-aicc-runtime-run-profile></dd></div><div class="aicc-runtime-row" data-aicc-runtime-row="run-id" hidden><dt>Run ID</dt><dd class="aicc-runtime-id" data-aicc-runtime-run-id></dd></div><div class="aicc-runtime-row" data-aicc-runtime-row="execution-id" hidden><dt>Execution ID</dt><dd class="aicc-runtime-id" data-aicc-runtime-execution-id></dd></div><div class="aicc-runtime-row" data-aicc-runtime-row="execution"><dt>Execution</dt><dd data-aicc-runtime-execution></dd></div><div class="aicc-runtime-row" data-aicc-runtime-row="result"><dt>Result</dt><dd data-aicc-runtime-result></dd></div><div class="aicc-runtime-row" data-aicc-runtime-row="updated"><dt>Updated</dt><dd data-aicc-runtime-updated></dd></div></dl><div class="aicc-result-preview-label">结果预览</div><pre class="aicc-result-preview" data-aicc-result-preview></pre><div class="aicc-result-actions" data-aicc-result-actions hidden><button type="button" data-aicc-copy-result aria-label="复制完整结果"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10h2"/></svg><span data-aicc-footer-label>复制结果</span></button><button type="button" data-aicc-expand-result><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4h6v6M20 4l-7 7M10 20H4v-6m0 6 7-7"/></svg><span data-aicc-footer-label>展开结果</span></button></div><div class="aicc-insert-gpt-footer"><button type="button" data-aicc-insert-gpt aria-label="插入 GPT" disabled title="插入 GPT · 当前没有可用的最新结果预览。">插入 GPT</button></div>';
      const resultActions = section.querySelector(SELECTORS.resultActions);
      const insertGptFooter = section.querySelector('.aicc-insert-gpt-footer');
      const insertGpt = section.querySelector(SELECTORS.insertGpt);
      if (resultActions && insertGptFooter && insertGpt) { resultActions.appendChild(insertGpt); insertGptFooter.remove(); }
      panel.appendChild(section);
    }
    bindPanelControl(SELECTORS.copyResult, copyPanelResult);
    bindPanelControl(SELECTORS.expandResult, togglePanelResult);
    bindPanelControl(SELECTORS.insertGpt, insertLatestResultToGpt);
    renderRuntimeProjection();
  }

  async function sendTask(text, originContext, source, operation = 'SEND_INSTRUCTION', metadata = {}) {
    if (!String(text || '').trim()) { const error = { reason: '没有找到可发送的任务内容。', code: 'INSTRUCTION_TEXT_REQUIRED' }; showError(error); throw error; }
    text = String(text);
    const projectionSource = operation === 'IMPORT_AND_RUN' ? metadata.sourceType || 'GPT_BLOCK' : 'AICC';
    const durableSource = metadata.sourceType || 'WEB_BRIDGE';
    const submissionId = window.AICCChatGPTDom.newSubmissionId();
    const pending = await pendingSubmissionFor(text, submissionId, durableSource, originContext);
    await persistStorage(PENDING_SUBMISSION_KEY, pending);
    runtimeAttemptUnbound = true;
    clearStatus();
    reportItem = null;
    reportCorrelation = null;
    syncActionButtons();
    const localCorrelation = { submissionId, instructionId: pending.instruction_id, sourceType: projectionSource };
    updateRuntimeProjection({ transition: 'SUBMITTING_LOCAL', sourceType: projectionSource, correlation: localCorrelation, reset: true, updatedAt: new Date().toISOString() });
    try {
      const result = await boundedMessage(operation, { text, submissionId, sourceReference: location.href, originContext, ...metadata });
      if (!result?.ok) throw result?.error || { code: 'AICC_SUBMISSION_FAILED', reason: 'AICC submission failed.' };
      const identity = window.AICCChatGPTDom.durableAck(result.item);
      if (!identity) throw { code: 'AICC_DURABLE_ACK_MISSING', reason: 'AICC did not return a durable instruction and task identity.' };
      reportCorrelation = result.correlation || { ...identity, inboxId: result.item.id, sourceType: projectionSource };
      await persistStorage(PENDING_SUBMISSION_KEY, { ...pending, ack_state: 'ACKNOWLEDGED', inbox_id: result.item.id, task_id: identity.taskId, execution_id: identity.executionId, run_id: identity.runId, updated_at: new Date().toISOString() });
      runtimeAttemptUnbound = false;
      const nextState = operation === 'IMPORT_AND_RUN' && identity.executionId && identity.runId ? 'RUN_CREATED' : 'AICC_ACCEPTED';
      updateRuntimeProjection({ transition: nextState, correlation: reportCorrelation, sourceType: projectionSource, runId: identity.runId, executionId: identity.executionId, updatedAt: result.item.updatedAt || new Date().toISOString() });
      try { await pollResult(); } catch (pollError) { updateRuntimeProjection({ transition: nextState, sourceType: projectionSource, correlation: reportCorrelation, error: pollError?.reason || pollError?.message || pollError?.code, updatedAt: new Date().toISOString() }); showError(pollError); }
      return result;
    } catch (error) {
      if (error?.code === 'SUBMISSION_STALLED') {
        const unconfirmed = { ...pending, ack_state: 'UNCONFIRMED', updated_at: new Date().toISOString() };
        await persistStorage(PENDING_SUBMISSION_KEY, unconfirmed);
        updateRuntimeProjection({ transition: 'SUBMISSION_STALLED', correlation: localCorrelation, sourceType: projectionSource, error: 'ACK_NOT_YET_CONFIRMED', updatedAt: new Date().toISOString() });
        setStatus('SUBMISSION_UNCONFIRMED · AICC 正在核对 durable 状态；不会自动重复提交。', 'BLOCKED');
        void reconcilePendingSubmission(unconfirmed);
        return { ok: false, unconfirmed: true, pending: unconfirmed };
      }
      updateRuntimeProjection({ transition: 'FAILED', sourceType: projectionSource, error: error?.reason || error?.message || error?.code, updatedAt: new Date().toISOString() });
      showError(error);
      throw error;
    }
  }

  async function sendInstruction() {
    refreshExplicitPayloadBinding();
    let binding = panelPayload();
    if (!binding) { try { binding = await readInboundClipboard(); } catch (error) { showError(error); return; } }
    return sendTask(binding.text, binding.originContext, binding.source === '已选指令' ? 'Selected Executable' : 'Clipboard', 'SEND_INSTRUCTION');
  }
  async function executeCurrentWithCodex() {
    if (codexExecutionInFlight) return;
    const binding = resolveCurrentPayload();
    if (!binding?.text) return setStatus('TARGET_NOT_FOUND · 未找到当前明确选择的发送目标。', 'ERROR');
    codexExecutionInFlight = true; syncActionButtons();
    try { await sendTask(binding.text, binding.originContext, 'Current Executable', 'IMPORT_AND_RUN', { sourceType: 'GPT_BLOCK' }); }
    finally { codexExecutionInFlight = false; syncActionButtons(); }
  }
  async function executeClipboardWithCodex() {
    if (clipboardExecutionInFlight) return;
    clipboardExecutionInFlight = true; syncActionButtons();
    try {
      const binding = await readInboundClipboard();
      await sendTask(binding.text, binding.originContext, 'CLIPBOARD_DIRECT', 'IMPORT_AND_RUN', { sourceType: 'CLIPBOARD_DIRECT', ownerDirectExecution: true });
    } catch (error) { showError(error); }
    finally { clipboardExecutionInFlight = false; syncActionButtons(); }
  }
  async function executeUsClaude() {
    if (usClaudeInFlight) return;
    usClaudeInFlight = true; syncActionButtons();
    try {
      const binding = await readInboundClipboard();
      await sendTask(binding.text, binding.originContext, 'Clipboard', 'SEND_INSTRUCTION', { sourceType: 'CLIPBOARD_DIRECT', ownerDirectExecution: true, executionProvider: 'REMOTE_CLAUDE', runnerId: 'US-WAREHOUSE-01' });
      for (let attempt = 0; attempt < 120; attempt += 1) {
        await pollResult();
        const result = currentPanelResult();
        if (result) {
          await copyAndInsertResult(result.text, result.metadata);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      throw { code: 'CANONICAL_RESULT_NOT_AVAILABLE', reason: 'AICC canonical result is not available.' };
    } catch (error) { showError(error); }
    finally { usClaudeInFlight = false; syncActionButtons(); }
  }
  async function executeNextStep() {
    if (nextStepInFlight) return;
    const target = composer();
    if (!target) return setStatus('CANONICAL_COMPOSER_UNAVAILABLE · 未找到可验证的 ChatGPT 底部输入框，未插入“下一步”。', 'BLOCKED');
    const sendButton = window.AICCChatGPTDom.findComposerSendButton(document, target);
    if (!sendButton || sendButton.disabled) return setStatus('COMPOSER_SEND_NOT_READY · ChatGPT 发送控件不可用，未执行下一步。', 'BLOCKED');
    nextStepInFlight = true; syncActionButtons();
    try {
      if (!window.AICCChatGPTDom.insertTextIntoComposer(target, '下一步')) return setStatus('NEXT_STEP_INSERT_FAILED · 未能插入“下一步”。', 'ERROR');
      if (!window.AICCChatGPTDom.ownerConfirmSend(document, target, window.AICCChatGPTDom.COMPOSER_ACTION_MODES.OWNER_CONFIRM_SEND)) return setStatus('COMPOSER_SEND_NOT_READY · “下一步”已插入但未发送。', 'BLOCKED');
      setStatus('已插入“下一步”并发送到 GPT。', 'SUCCESS');
    } catch (error) { showError(error); }
    finally { nextStepInFlight = false; syncActionButtons(); }
  }
  async function pasteClipboardAndSendToChatGpt() {
    if (clipboardChatGptSendInFlight) return;
    clipboardChatGptSendInFlight = true;
    try {
      if (!navigator.clipboard?.readText) throw { code: 'CLIPBOARD_READ_UNAVAILABLE', reason: 'Clipboard unavailable' };
      let clipboardText;
      try { clipboardText = await navigator.clipboard.readText(); }
      catch (error) { throw { code: 'CLIPBOARD_READ_FAILED', reason: error?.message || String(error) }; }
      if (!String(clipboardText || '').trim()) throw { code: 'CLIPBOARD_TEXT_REQUIRED', reason: 'Clipboard is empty' };
      const target = composer();
      if (!target) throw { code: 'CANONICAL_COMPOSER_UNAVAILABLE', reason: 'ChatGPT composer unavailable' };
      if (String(window.AICCChatGPTDom.textOf(target) || '')) throw { code: 'COMPOSER_CONTAINS_EXISTING_INPUT', reason: 'Composer contains existing user input' };
      let clipboardInserted = false;
      try {
        const submission = await window.AICCChatGPTDom.submitChatGPTComposerOnce({
          document,
          conversationId: currentConversationId(),
          requireExactConversation: Boolean(currentConversationId()),
          requireEmptyComposer: true,
          payload: clipboardText,
          submissionId: window.AICCChatGPTDom.newSubmissionId(),
          onInserted: () => { clipboardInserted = true; }
        });
        setStatus(`Clipboard sent to ChatGPT · ${submission.userMessageId || 'confirmed'}`, 'SUCCESS');
        return submission;
      } catch (error) {
        if (error?.message === 'COMPOSER_CONTAINS_EXISTING_INPUT') throw { code: 'COMPOSER_CONTAINS_EXISTING_INPUT', reason: 'Composer contains existing user input' };
        if (clipboardInserted && error?.message === 'COMPOSER_SEND_NOT_READY') throw { code: 'COMPOSER_SEND_NOT_READY', reason: 'ChatGPT submit unavailable; clipboard text remains in composer' };
        throw error;
      }
    } catch (error) { showError(error); throw error; }
    finally { clipboardChatGptSendInFlight = false; }
  }
  function mountNativeActions() { console.log('[AICC composer mount] caller entered'); window.AICCChatGPTDom.removeChatContentFloatingButtons(document); const canonicalImportAndRun = (text, originContext) => sendTask(text, originContext, 'Composer', 'IMPORT_AND_RUN', { sourceType: 'GPT_BLOCK' }); console.log('[AICC composer mount] API available', Boolean(window.AICCChatGPTDom?.mountComposerAiccAction)); window.AICCChatGPTDom.mountComposerAiccAction(document, canonicalImportAndRun); refreshExplicitPayloadBinding(); }
  function safeMountNativeActions() { try { mountNativeActions(); } catch (error) { try { console.warn('[AICC composer mount] isolated failure', error); } catch {} } }

  let nativeMountQueued = false;
  function scheduleNativeMount() {
    if (nativeMountQueued) return;
    nativeMountQueued = true;
    queueMicrotask(() => { nativeMountQueued = false; try { mount(); } catch (error) { try { console.warn('[AICC bridge mount] isolated failure', error); } catch {} } safeMountNativeActions(); });
  }

  async function pollResult(allowAutomaticFeedback = false) {
    if (runtimeAttemptUnbound || ['SUBMISSION_STALLED', 'AICC_ACCEPTED', 'RUN_CREATED', 'RUNNING'].includes(runtimeProjection.status)) await reconcilePendingSubmission();
    const result = await message('POLL_RESULT', { correlation: reportCorrelation });
    if (!result?.ok) { showError(result?.error); return result; }
    if (runtimeAttemptUnbound) return result;
    reportItem = result.item?.item || result.item || null;
    reportCorrelation = result.correlation || result.item?.correlation || null;
    updateRuntimeProjection({ correlation: reportCorrelation, item: reportItem, updatedAt: reportItem?.updatedAt || new Date().toISOString() });
    syncActionButtons();
    if (reportItem) {
      const readyResult = codexExecutionResult(reportItem);
      const readyRunId = reportItem.report?.runId || reportItem.runId || reportCorrelation?.runId || null;
      const readyResultId = readyResult?.resultId || reportItem.id || readyRunId;
      if (resultInsertStatus.runId !== readyRunId || resultInsertStatus.resultId !== readyResultId) updateResultInsertStatus(ResultInsertStatus.READY, { runId: readyRunId, resultId: readyResultId, resultSource: readyResult ? 'CODEX_RESULT' : 'AICC_RESULT' });
      await refreshAutoLoopStatus();
      if (allowAutomaticFeedback) await submitAutomaticFeedback();
    }
    return result;
  }

  async function copyAndInsertResult(text, metadata, target = composer()) {
    const canonicalTarget = composer();
    if (!target || target !== canonicalTarget) {
      setStatus('CANONICAL_COMPOSER_UNAVAILABLE · 未找到可验证的 ChatGPT 底部输入框，未插入任何内容。', 'BLOCKED');
      return { copied: false, inserted: false, destinationRejected: true };
    }
    const identity = `${metadata.resultSource}:${metadata.resultId || metadata.runId || 'ABSENT'}`;
    if (insertedResultIds.has(identity)) {
      try { await navigator.clipboard.writeText(String(text)); setStatus('完整结果已复制到剪贴板；GPT 输入框已包含该结果', 'SUCCESS'); return { copied: true, inserted: true, alreadyInserted: true }; }
      catch (copyError) { setStatus('GPT 输入框已包含该结果，但复制到剪贴板失败', 'ERROR'); return { copied: false, inserted: true, alreadyInserted: true, copyError }; }
    }
    const outcome = await window.AICCChatGPTDom.copyAndInsertResultArtifact(target, text, navigator.clipboard, status => {
      updateResultInsertStatus(ResultInsertStatus[status], metadata);
      if (status === 'COPYING') setStatus('正在复制结果到剪贴板…', 'RUNNING');
      if (status === 'COPIED') setStatus('结果已复制，正在定位 GPT 输入框…', 'RUNNING');
      if (status === 'INSERTING') setStatus('正在插入 GPT 输入框…', 'RUNNING');
    });
    if (outcome.inserted) insertedResultIds.add(identity);
    if (outcome.copied && outcome.inserted) setStatus('结果已复制并插入 GPT 输入框', 'SUCCESS');
    else if (outcome.copied) setStatus('GPT 输入框未定位，结果已复制到剪贴板', 'SUCCESS');
    else if (outcome.inserted) setStatus('结果已插入 GPT 输入框，但复制到剪贴板失败', 'ERROR');
    else setStatus('结果复制和 GPT 输入框插入均失败，结果仍保留在 AICC', 'ERROR');
    return outcome;
  }

  function currentPanelResult() {
    if (runtimeProjection.resultState !== 'AVAILABLE' || !runtimeProjection.runId || !String(runtimeProjection.resultText || '').trim()) return null;
    return { text: runtimeProjection.resultText, metadata: { runId: runtimeProjection.runId, resultId: runtimeProjection.resultId || runtimeProjection.resultHash, resultSource: runtimeProjection.source === 'AICC' ? 'AICC_RESULT' : 'CODEX_RESULT' } };
  }
  async function insertLatestResultToGpt() {
    if (insertGptInFlight) return;
    const result = currentPanelResult();
    const resultId = result?.metadata.resultId || result?.metadata.runId || '';
    if (!result) return setStatus('RESULT_PREVIEW_NOT_AVAILABLE · 当前没有可用的最新结果预览。', 'BLOCKED');
    if (attemptedGptResultIds.has(resultId)) return setStatus('GPT_SUBMISSION_ALREADY_ATTEMPTED · 当前结果不会重复提交。', 'BLOCKED');
    const target = composer();
    if (!target) return setStatus('CANONICAL_COMPOSER_UNAVAILABLE · 未找到可验证的 ChatGPT 底部输入框，未提交结果。', 'BLOCKED');
    insertGptInFlight = true;
    renderRuntimeProjection();
    try {
      let inserted = window.AICCChatGPTDom.reportFormatPresent(target, result.text);
      if (!inserted) inserted = window.AICCChatGPTDom.insertTextIntoComposer(target, result.text);
      if (!inserted || !(await window.AICCChatGPTDom.verifyComposerText(target, result.text, [0, 50, 150]))) {
        setStatus('INSERT_GPT_VERIFICATION_FAILED · 结果未通过 Composer 插入校验，未提交。', 'ERROR');
        return;
      }
      const currentSendButton = window.AICCChatGPTDom.findComposerSendButton(document, target);
      if (!currentSendButton || currentSendButton.disabled) return setStatus('COMPOSER_SEND_NOT_READY · 结果已插入 GPT 输入框，但发送控件不可用。', 'BLOCKED');
      const conversationId = currentConversationId();
      if (!conversationId) return setStatus('EXACT_CONVERSATION_REQUIRED · 未绑定当前 ChatGPT 会话，未提交。', 'BLOCKED');
      const submissionId = window.AICCChatGPTDom.newSubmissionId();
      const submission = await window.AICCChatGPTDom.submitChatGPTComposerOnce({
        document,
        conversationId,
        payload: result.text,
        submissionId,
        beforeSubmit: () => { attemptedGptResultIds.add(resultId); renderRuntimeProjection(); }
      });
      submittedGptResultIds.add(resultId);
      setStatus(`结果已插入并发送到 GPT · ${submission.userMessageId || '已确认'}`, 'SUCCESS');
    } catch (error) {
      showError({ code: 'INSERT_GPT_FAILED', reason: error?.message || '结果插入或 GPT 提交失败。' });
    } finally {
      insertGptInFlight = false;
      renderRuntimeProjection();
    }
  }
  async function copyPanelResult() {
    if (panelResultInFlight) return;
    const result = currentPanelResult(); if (!result) return setStatus('暂无可复制的运行结果。', 'BLOCKED');
    panelResultInFlight = true; renderRuntimeProjection();
    try { await navigator.clipboard.writeText(result.text); setStatus('完整结果已复制到剪贴板', 'SUCCESS'); }
    catch { setStatus('结果复制失败，完整结果仍保留在运行面板', 'ERROR'); }
    finally { panelResultInFlight = false; renderRuntimeProjection(); }
  }
  function togglePanelResult() { if (!currentPanelResult()) return; resultExpanded = !resultExpanded; renderRuntimeProjection(); }

  async function deliverCanonicalResult() {
    const ownerRequested = codexResultInFlight || panelResultInFlight;
    const canonicalResult = codexExecutionResult(reportItem);
    if (returnInFlight || !canonicalResult?.rawResult || !reportCorrelation?.originContext?.conversationId) return;
    const returnId = canonicalResult.resultId || reportItem.runId;
    if (!returnId || !isExactOriginConversation()) return;
    const manualRetry = ownerRequested && attemptedReturnIds.has(returnId);
    if (!ownerRequested && attemptedReturnIds.has(returnId)) return;
    attemptedReturnIds.add(returnId);
    returnInFlight = true;
    try {
      let envelope = canonicalResult.rawResult;
      let claimIdentity = null;
      if (!manualRetry) {
        const claimed = await message('RETURN_RESULT', { sourceReference: location.href, originContext: window.AICCChatGPTDom.originContext(document, null), correlation: reportCorrelation });
        if (!claimed?.ok) { showError(claimed?.error); return; }
        if (claimed.alreadyReturned || claimed.deliveryInProgress) return;
        envelope = claimed.envelope;
        claimIdentity = claimed.identity;
        if (!envelope) { await message('MARK_RETURN_FAILED', { identity: claimIdentity, reason: 'RESULT_ENVELOPE_UNAVAILABLE' }); showError({ code: 'RESULT_ENVELOPE_UNAVAILABLE', reason: 'Codex 结果信封不可用。' }); return; }
      }
      const outcome = await copyAndInsertResult(envelope, { runId: reportItem.runId || reportItem.report?.runId, resultId: canonicalResult.resultId || returnId, resultSource: 'CODEX_RESULT' });
      if (manualRetry) return outcome;
      if (!outcome.copied && !outcome.inserted) { attemptedReturnIds.delete(returnId); await message('MARK_RETURN_FAILED', { identity: claimIdentity, reason: 'RESULT_DELIVERY_FAILED' }); return; }
      const completed = await message('MARK_RETURN_COMPLETE', { identity: claimIdentity });
      if (!completed?.ok) showError(completed?.error);
    } finally { returnInFlight = false; }
  }

  async function insertCodexResult() {
    if (codexResultInFlight || panelResultInFlight) return;
    codexResultInFlight = true; syncActionButtons();
    try {
      const result = await pollResult(false);
      if (!result?.ok || !codexExecutionResult(reportItem)?.rawResult) return setStatus('暂无可插入的 Codex 结果。', 'BLOCKED');
      await deliverCanonicalResult();
    } finally { codexResultInFlight = false; syncActionButtons(); }
  }


  function reportText(item) {
    return window.AICCChatGPTDom.bridgeReportText(item);
  }

  async function insertPanelResult() {
    if (panelResultInFlight || codexResultInFlight) return;
    const result = currentPanelResult(); if (!result) return setStatus('暂无可插入的运行结果。', 'BLOCKED');
    panelResultInFlight = true; renderRuntimeProjection();
    try {
      if (runtimeProjection.source === 'AICC') await insertReport();
      else await deliverCanonicalResult();
    }
    finally { panelResultInFlight = false; renderRuntimeProjection(); }
  }

  async function insertReport() {
    if (!isInsertableReport(reportItem)) return setStatus('暂无可用的 AICC_RUN_REPORT_V1。', 'BLOCKED');
    const text = reportText(reportItem);
    const runId = reportItem.runId || reportItem.report?.runId;
    const exactOrigin = reportCorrelation?.sourceReference === location.href && reportCorrelation?.originContext?.conversationId === window.AICCChatGPTDom.originContext(document, null).conversationId;
    const outcome = await copyAndInsertResult(text, { runId, resultId: `aicc-report-${runId || reportItem.id}`, resultSource: 'AICC_RESULT' }, exactOrigin ? composer() : null);
    if (!outcome.inserted) return;
    const marked = await message('MARK_REPORT_INSERTED', { runId: reportItem.runId || reportItem.report?.runId, reportVersion: reportItem.report?.version, sourceReference: location.href });
    if (!marked?.ok) return showError(marked?.error);
  }

  function mount() {
    const existing = document.querySelector(SELECTORS.mount);
    if (existing) { panel = existing; removeLegacyAutoLoopUi(); addPanelStyle(); ensurePanelActions(); ensureAutoLoopSetup(); ensureRuntimeResultPanel(); renderPanelState(); return; }
    addPanelStyle();
    panel = document.createElement('aside');
    panel.dataset.aiccGptBridgeExtension = 'true';
    panel.className = 'aicc-bridge-panel';
    panel.innerHTML = '<h1 class="aicc-bridge-title">AICC Bridge <button type="button" data-aicc-collapse aria-label="折叠 AICC Bridge">‹</button></h1><div class="aicc-auto-loop-summary"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 9A7 7 0 0 1 18.5 7.5L20 12M4 12l1.5 4.5A7 7 0 0 0 17.9 15"/></svg><span data-aicc-auto-loop-status>AUTO LOOP · NOT BOUND</span></div><small class="aicc-auto-loop-details" data-aicc-auto-loop-details></small><details class="aicc-auto-control" data-aicc-auto-loop-setup open><summary>自动控制</summary><div class="aicc-auto-control-box"><label><input type="checkbox" data-aicc-auto-loop-bind> 锁定 GPT 聊天口</label><label><input type="checkbox" data-aicc-auto-loop-toggle disabled> 开启自动循环</label></div></details><div class="aicc-primary-actions"></div>';
    document.body.appendChild(panel);
    removeLegacyAutoLoopUi();
    let handle = document.querySelector(SELECTORS.handle);
    if (!handle) { handle = document.createElement('button'); handle.type = 'button'; handle.className = 'aicc-bridge-expand-handle'; handle.dataset.aiccExpandHandle = 'true'; handle.textContent = '›'; handle.setAttribute('aria-label', '展开 AICC Bridge'); handle.hidden = true; document.body.appendChild(handle); }
    panel.querySelector(SELECTORS.collapse).addEventListener('click', () => setPanelExpanded(false));
    if (handle.dataset.aiccBound !== 'true') { handle.addEventListener('click', () => setPanelExpanded(true)); handle.dataset.aiccBound = 'true'; }
    ensurePanelActions();
    ensureAutoLoopSetup();
    ensureRuntimeResultPanel();
    refreshExplicitPayloadBinding();
    restorePanelState();
    restoreResultInsertStatus();
    restoreCodexProfile();
    restoreRuntimeProjection(() => { void refreshAutoLoopStatus(); void pollResult(); void refreshUsClaudeCapability(); });
  }

  function isAiccOwnedNode(node) {
    const element = node?.nodeType === 1 ? node : node?.parentElement;
    return Boolean(element?.closest?.('[data-aicc-gpt-bridge-extension], [data-aicc-expand-handle], [data-aicc-composer-rail], [data-aicc-bridge-style], [data-aicc-panel-style]'));
  }
  function hasExternalDomMutation(records) {
    return records.some(record => [...record.addedNodes].some(node => !isAiccOwnedNode(node)));
  }
  let protocolCaptureQueued = false;
  function scheduleProtocolCapture() {
    if (protocolCaptureQueued) return;
    protocolCaptureQueued = true;
    window.setTimeout(() => { protocolCaptureQueued = false; void captureExplicitBugProtocols(); void captureExplicitLocalSyncProtocols(); }, 250);
  }
  window.setInterval(() => { void pollResult(); void consumeNewAssistantControl(); }, 3000);
  window.setInterval(() => { void refreshUsClaudeCapability(); }, 15000);
  const bootstrapObserver = new MutationObserver(() => {
    if (!document.body) return;
    bootstrapObserver.disconnect();
    try { mount(); } catch (error) { try { console.warn('[AICC bridge mount] isolated failure', error); } catch {} }
    safeMountNativeActions(); scheduleProtocolCapture();
  });
  if (document.body) { try { mount(); } catch (error) { try { console.warn('[AICC bridge mount] isolated failure', error); } catch {} } safeMountNativeActions(); scheduleProtocolCapture(); }
  else bootstrapObserver.observe(document.documentElement, { childList: true, subtree: true });
  new MutationObserver(records => {
    if (!hasExternalDomMutation(records)) return;
    scheduleNativeMount();
    scheduleProtocolCapture();
  }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('selectionchange', refreshExplicitPayloadBinding);
}());
