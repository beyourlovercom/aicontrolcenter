(function (root) {
  'use strict';
  const SELECTORS = Object.freeze({
    assistant: [
      '[data-message-author-role="assistant"]',
      '[data-testid*="conversation-turn"] [data-message-author-role="assistant"]',
      'article[data-message-author-role="assistant"]'
    ],
    user: [
      '[data-message-author-role="user"]',
      '[data-testid*="conversation-turn"] [data-message-author-role="user"]',
      'article[data-message-author-role="user"]'
    ],
    composer: ['[contenteditable="true"]', 'textarea']
  });
  const BridgeRuntimeState = Object.freeze({ IDLE: 'IDLE', SUBMITTING_LOCAL: 'SUBMITTING_LOCAL', TRANSPORT_SENT: 'TRANSPORT_SENT', AICC_ACCEPTED: 'AICC_ACCEPTED', RUN_CREATED: 'RUN_CREATED', RUNNING: 'RUNNING', COMPLETED: 'COMPLETED', FAILED: 'FAILED', SUBMISSION_STALLED: 'SUBMISSION_STALLED' });
  const BridgeResultState = Object.freeze({ NONE: 'NONE', WAITING: 'WAITING', AVAILABLE: 'AVAILABLE' });
  const BridgeExecutionSource = Object.freeze({ CLIPBOARD_DIRECT: 'CLIPBOARD_DIRECT', GPT_BLOCK: 'GPT_BLOCK', AICC: 'AICC' });
  const COMPOSER_ACTION_MODES = Object.freeze({ INSERT_ONLY: 'INSERT_ONLY', OWNER_CONFIRM_SEND: 'OWNER_CONFIRM_SEND' });
  const SUBMISSION_ACK_TIMEOUT_MS = 8000;

  function textOf(node) { if (!node) return ''; if ('value' in node) return node.value || ''; if (node.cloneNode) { const clone = node.cloneNode(true); clone.querySelectorAll?.('button,[data-aicc-action]')?.forEach(child => child.remove()); return clone.innerText || clone.textContent || ''; } return node.innerText || node.textContent || ''; }
  function normalizedText(value) { return String(value || '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').replace(/\n{2,}/g, '\n'); }
  function reportFormatPresent(node, expected) { return normalizedText(textOf(node)).includes(normalizedText(expected)); }
  function placeCaretAtEnd(node) {
    const selection = root.getSelection && root.getSelection();
    const documentRef = node && node.ownerDocument;
    if (!selection || !documentRef || !documentRef.createRange) return false;
    const range = documentRef.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }
  function insertTextIntoComposer(node, text) {
    if (!node) return false;
    node.focus && node.focus();
    const existing = textOf(node);
    const separator = existing && !/[\n\r]$/.test(existing) ? '\n\n' : '';
    const value = `${separator}${text}`;
    if ('value' in node) {
      const documentRef = node.ownerDocument;
      const prototype = documentRef && documentRef.defaultView && documentRef.defaultView.HTMLTextAreaElement;
      const setter = prototype && Object.getOwnPropertyDescriptor(prototype.prototype, 'value')?.set;
      if (setter) setter.call(node, existing + value); else node.value = existing + value;
      node.dispatchEvent && node.dispatchEvent(new Event('input', { bubbles: true }));
      return reportFormatPresent(node, text);
    }
    placeCaretAtEnd(node);
    const documentRef = node.ownerDocument || root.document;
    const inserted = documentRef && documentRef.execCommand && documentRef.execCommand('insertText', false, value);
    node.dispatchEvent && node.dispatchEvent(new Event('input', { bubbles: true }));
    return inserted !== false && reportFormatPresent(node, text);
  }
  function verifyComposerText(node, text, delays = [0, 500, 1500, 3000]) {
    return Promise.all(delays.map(delay => new Promise(resolve => setTimeout(() => resolve(reportFormatPresent(node, text)), delay))))
      .then(results => results.every(Boolean));
  }
  async function copyAndInsertResultArtifact(node, text, clipboard, onStatus = () => {}) {
    const artifact = String(text || '');
    if (!artifact) return { copied: false, inserted: false, copyError: new Error('RESULT_TEXT_REQUIRED') };
    let copied = false;
    let copyError = null;
    onStatus('COPYING');
    try {
      if (!clipboard?.writeText) throw new Error('CLIPBOARD_WRITE_UNAVAILABLE');
      await clipboard.writeText(artifact);
      copied = true;
      onStatus('COPIED');
    } catch (error) {
      copyError = error;
      onStatus('COPY_ONLY_FAILED');
    }
    onStatus('INSERTING');
    let inserted = Boolean(node && reportFormatPresent(node, artifact));
    if (!inserted && node) {
      inserted = insertTextIntoComposer(node, artifact);
      if (inserted) inserted = await verifyComposerText(node, artifact, [0, 50, 150]);
    }
    onStatus(inserted ? 'INSERTED' : copied ? 'COPIED' : 'COPY_ONLY_FAILED');
    return { copied, inserted, copyError };
  }
  function bridgeExecutionSource(sourceType) {
    if (sourceType === BridgeExecutionSource.CLIPBOARD_DIRECT) return BridgeExecutionSource.CLIPBOARD_DIRECT;
    if (sourceType === BridgeExecutionSource.GPT_BLOCK) return BridgeExecutionSource.GPT_BLOCK;
    return BridgeExecutionSource.AICC;
  }
  function canonicalResultText(item) { return typeof item?.report?.canonicalResult?.rawResult === 'string' ? item.report.canonicalResult.rawResult : ''; }
  function bridgeReportText(item) { const report = item?.report || {}; return ['AICC_RUN_REPORT_V1', `Run ID: ${report.runId || item?.runId || 'ABSENT'}`, `Entity: ${report.entityId || 'ABSENT'}`, `Execution type: ${report.executionType || 'UNAVAILABLE'}`, '', `Runtime Result: ${report.status || 'UNAVAILABLE'}`, `Gate Result: ${report.gateResult || 'UNAVAILABLE'}`, '', 'Summary:', `${report.summary || 'UNAVAILABLE'}`].join('\n'); }
  function emptyBridgeRuntimeProjection(updatedAt = new Date().toISOString()) {
    return { status: BridgeRuntimeState.IDLE, source: null, submissionId: null, instructionId: null, taskId: null, inboxId: null, runId: null, executionId: null, model: null, reasoningEffort: null, modelSource: null, resultState: BridgeResultState.NONE, resultId: null, resultHash: null, resultText: '', error: null, updatedAt };
  }
  function newSubmissionId() { return `aicc-submission-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xfffffff).toString(36)}`; }
  function extensionContextUsable(runtime = root.chrome) { try { return Boolean(runtime?.runtime?.id && typeof runtime.runtime.sendMessage === 'function'); } catch { return false; } }
  function durableAck(item) { const instructionId = item?.instructionId || item?.instruction?.instructionId; if (!item?.id || !instructionId || !item?.taskId) return null; return { submissionId: item.submissionId || item.id, instructionId, taskId: item.taskId, executionId: item.executionId || null, runId: item.runId || null }; }
  function hasExecutionIdentity(value) { return Boolean(value?.executionId && value?.runId); }
  function recoverBridgeRuntimeProjection(projection) { if ([BridgeRuntimeState.SUBMITTING_LOCAL, BridgeRuntimeState.TRANSPORT_SENT].includes(projection?.status) && !projection?.submissionId && !projection?.taskId && !hasExecutionIdentity(projection)) return emptyBridgeRuntimeProjection(); return projection; }
  function projectBridgeRuntime(input = {}) {
    const previous = input.reset ? emptyBridgeRuntimeProjection(input.updatedAt) : input.previous || emptyBridgeRuntimeProjection(input.updatedAt);
    const correlation = input.correlation || null;
    const item = input.item || null;
    const source = bridgeExecutionSource(input.sourceType || correlation?.sourceType || previous.source);
    const ack = durableAck(item);
    const inboxId = correlation?.inboxId || item?.inboxId || previous.inboxId || null;
    const correlationRunId = correlation?.runId || input.runId || null;
    const itemRunId = item?.report?.runId || item?.runId || null;
    const runId = itemRunId || correlationRunId || previous.runId || null;
    const executionId = item?.executionId || item?.report?.executionId || item?.report?.canonicalResult?.executionId || input.executionId || previous.executionId || null;
    const model = item?.report?.model || item?.model || input.model || previous.model || null;
    const reasoningEffort = item?.report?.reasoning_effort || item?.reasoning_effort || input.reasoningEffort || previous.reasoningEffort || null;
    const modelSource = item?.report?.model_source || item?.model_source || input.modelSource || previous.modelSource || null;
    const updatedAt = input.updatedAt || item?.updatedAt || item?.report?.canonicalResult?.receivedAt || new Date().toISOString();
    const sameInbox = !correlation?.inboxId || !item?.inboxId || correlation.inboxId === item.inboxId;
    const sameRun = !correlationRunId || !itemRunId || correlationRunId === itemRunId;
    const terminalPreviousMatches = previous.inboxId === inboxId && (!correlationRunId || previous.runId === correlationRunId) && [BridgeRuntimeState.COMPLETED, BridgeRuntimeState.FAILED].includes(previous.status);
    if (!item || !sameInbox || !sameRun) {
      if (!item && terminalPreviousMatches && !input.transition) return previous;
      const status = Object.values(BridgeRuntimeState).includes(input.transition) ? input.transition : correlationRunId && [BridgeRuntimeState.RUN_CREATED, BridgeRuntimeState.RUNNING].includes(previous.status) ? previous.status : correlationRunId ? BridgeRuntimeState.TRANSPORT_SENT : inboxId ? BridgeRuntimeState.AICC_ACCEPTED : BridgeRuntimeState.IDLE;
      return { ...previous, status, source: status === BridgeRuntimeState.IDLE ? null : source, submissionId: correlation?.submissionId || previous.submissionId || null, instructionId: ack?.instructionId || correlation?.instructionId || previous.instructionId || null, taskId: ack?.taskId || correlation?.taskId || previous.taskId || null, inboxId, runId: correlationRunId, executionId: input.executionId || ack?.executionId || null, model, reasoningEffort, modelSource, resultState: status === BridgeRuntimeState.IDLE ? BridgeResultState.NONE : BridgeResultState.WAITING, resultId: null, resultHash: null, resultText: '', error: input.error ? String(input.error) : null, updatedAt };
    }
    const runtimeState = item.report?.status || '';
    const failed = ['FAILED', 'STOPPED', 'RECOVERY_REQUIRED'].includes(runtimeState);
    const completed = runtimeState === 'COMPLETED';
    const status = failed ? BridgeRuntimeState.FAILED : completed ? BridgeRuntimeState.COMPLETED : hasExecutionIdentity({executionId, runId}) ? BridgeRuntimeState.RUNNING : ack ? BridgeRuntimeState.AICC_ACCEPTED : BridgeRuntimeState.TRANSPORT_SENT;
    const canonicalResult = item.report?.canonicalResult;
    const resultText = source === BridgeExecutionSource.AICC ? bridgeReportText(item) : canonicalResult?.version === 'AICC_EXECUTION_RESULT_V1' ? canonicalResultText(item) : '';
    const resultBound = Boolean(hasExecutionIdentity({ executionId, runId }) && itemRunId && resultText.trim() && [BridgeRuntimeState.COMPLETED, BridgeRuntimeState.FAILED].includes(status));
    const resultId = resultBound ? canonicalResult?.resultId || null : null;
    const resultHash = resultBound ? canonicalResult?.resultHash || null : null;
    const runtimeError = failed ? item.report?.summary || canonicalResult?.codexReason || null : null;
    return { ...previous, status, source, submissionId: ack?.submissionId || correlation?.submissionId || previous.submissionId || null, instructionId: ack?.instructionId || correlation?.instructionId || previous.instructionId || null, taskId: ack?.taskId || correlation?.taskId || previous.taskId || null, inboxId: item.inboxId || inboxId, runId: itemRunId, executionId, model, reasoningEffort, modelSource, resultState: resultBound ? BridgeResultState.AVAILABLE : BridgeResultState.WAITING, resultId, resultHash, resultText: resultBound ? resultText : '', error: input.error ? String(input.error) : runtimeError, updatedAt };
  }
  function assistantMessages(document) {
    for (const selector of SELECTORS.assistant) {
      const nodes = Array.from(document.querySelectorAll(selector));
      if (nodes.length) return nodes;
    }
    return [];
  }
  function userMessages(document) {
    for (const selector of SELECTORS.user) {
      const nodes = Array.from(document.querySelectorAll(selector));
      if (nodes.length) return nodes;
    }
    return [];
  }
  function assistantMessageIdentity(message, messageIndex = 0) {
    const explicit = message?.getAttribute?.('data-message-id') || message?.getAttribute?.('data-turn-id') || message?.id || message?.getAttribute?.('data-testid');
    return String(explicit || `assistant-${messageIndex}-${stableSurfaceHash(exactNormalizedText(textOf(message)))}`);
  }
  function userMessageIdentity(message, messageIndex = 0) {
    const explicit = message?.getAttribute?.('data-message-id') || message?.getAttribute?.('data-turn-id') || message?.id || message?.getAttribute?.('data-testid');
    return String(explicit || `user-${messageIndex}-${stableSurfaceHash(exactNormalizedText(textOf(message)))}`);
  }
  function submittedUserMessage(document, payload) {
    const expected = exactNormalizedText(payload);
    return userMessages(document).find(message => exactNormalizedText(textOf(message)) === expected) || null;
  }
  function submittedUserMessageIdentity(document, payload) {
    const message = submittedUserMessage(document, payload);
    if (!message) return null;
    return userMessageIdentity(message, userMessages(document).indexOf(message));
  }
  function liveComposerSendCondition(document, allowEmptyComposer = false) {
    const composer = resolveCanonicalChatGPTComposer(document);
    const sendButton = findComposerSendButton(document, composer);
    const composerText = exactNormalizedText(textOf(composer));
    const sendReady = composer && composerText && sendButton;
    return {composer, composerText, sendButton, ready: allowEmptyComposer ? Boolean(composer && sendButton) : Boolean(sendReady) && !sendButton?.disabled};
  }
  async function waitForLiveComposerSendCondition(document, timeoutMs = 10000, pollIntervalMs = 75, allowEmptyComposer = false) {
    const startedAt = Date.now();
    while (Date.now() - startedAt <= timeoutMs) {
      const condition = liveComposerSendCondition(document, allowEmptyComposer);
      if (condition.ready) return condition;
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
    throw new Error('COMPOSER_SEND_NOT_READY');
  }
  async function waitForSubmittedUserMessage(document, payload, delays = [0, 75, 150, 300, 600, 1200, 2400, 4000]) {
    for (const delay of delays) {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      const message = submittedUserMessage(document, payload);
      if (message) return message;
    }
    throw new Error('GPT_FEEDBACK_MESSAGE_NOT_CONFIRMED');
  }
  async function submitChatGPTComposerOnce({document = root.document, conversationId, payload, submissionId, composerReadyTimeoutMs = 10000, composerReadyPollIntervalMs = 75, requireExactConversation = true, requireEmptyComposer = false, onInserted, afterInsert, beforeSubmit} = {}) {
    const expectedConversationId = String(conversationId || '');
    if (requireExactConversation && (!expectedConversationId || resolveConversationId(document?.location || root.location) !== expectedConversationId)) throw new Error('EXACT_CONVERSATION_REQUIRED');
    const exactPayload = String(payload || '');
    if (!exactPayload.trim() || !String(submissionId || '').trim()) throw new Error('FEEDBACK_SUBMISSION_IDENTITY_REQUIRED');
    const initial = await waitForLiveComposerSendCondition(document, composerReadyTimeoutMs, composerReadyPollIntervalMs, true);
    if (requireEmptyComposer && String(textOf(initial.composer) || '')) throw new Error('COMPOSER_CONTAINS_EXISTING_INPUT');
    if (!reportFormatPresent(initial.composer, exactPayload)) {
      if (!insertTextIntoComposer(initial.composer, exactPayload)) throw new Error('FEEDBACK_COMPOSER_INSERT_FAILED');
    }
    if (onInserted) await onInserted();
    const ready = await waitForLiveComposerSendCondition(document, composerReadyTimeoutMs, composerReadyPollIntervalMs);
    if (afterInsert) await afterInsert();
    if (beforeSubmit) await beforeSubmit();
    const sendButton = findComposerSendButton(document, ready.composer);
    if (!sendButton || sendButton.disabled) throw new Error('COMPOSER_SEND_NOT_READY');
    sendButton.click();
    const message = await waitForSubmittedUserMessage(document, exactPayload);
    return {submissionId, userMessage: message, userMessageId: submittedUserMessageIdentity(document, exactPayload)};
  }
  function exactNormalizedText(value) { return normalizedText(value).trim(); }
  async function submissionPayloadHash(payload) {
    const normalized = exactNormalizedText(payload);
    try {
      if (root.crypto?.subtle && root.TextEncoder) {
        const digest = await root.crypto.subtle.digest('SHA-256', new root.TextEncoder().encode(normalized));
        return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('');
      }
    } catch { /* deterministic fallback below */ }
    return `fnv1a-${stableSurfaceHash(normalized)}`;
  }
  function positionFloatingAction(document, rail, anchor, side = 'right') {
    if (!rail || !anchor?.getBoundingClientRect) return false;
    const rect = anchor.getBoundingClientRect();
    const width = rail.getBoundingClientRect?.().width || 86;
    const left = side === 'left' ? Math.max(8, rect.left - width - 8) : Math.min(Math.max(8, rect.right + 8), Math.max(8, (root.innerWidth || 1280) - width - 8));
    const top = `${Math.max(8, rect.top + 4)}px`;
    const nextLeft = `${left}px`;
    rail.style.left = nextLeft;
    rail.style.top = top;
    return true;
  }
  function removeChatContentFloatingButtons(document) {
    if (!document?.querySelectorAll) return 0;
    const selectors = [
      '.aicc-executable-action-rail',
      '[data-aicc-action-rail]',
      '.aicc-assistant-action',
      '[data-aicc-action="assistant"]'
    ];
    const nodes = Array.from(document.querySelectorAll(selectors.join(',')));
    nodes.forEach(node => node.remove?.());
    return nodes.length;
  }
  function isVisible(node) {
    if (!node || node.isConnected === false) return false;
    if (typeof node.getClientRects !== 'function' && typeof node.offsetParent === 'undefined') return true;
    return node.offsetParent !== null || Boolean(node.getClientRects?.().length);
  }
  function isAssistantContent(node) {
    return Boolean(node?.closest?.('[data-message-author-role="assistant"], [data-testid*="conversation-turn"] [data-message-author-role="assistant"], article[data-message-author-role="assistant"]'));
  }
  function isNonComposerSurface(node) {
    return Boolean(node?.closest?.('[data-message-author-role="assistant"], [data-testid*="conversation-turn"], [data-testid*="writing-block"], [data-writing-block], [data-testid*="artifact"], [data-testid*="canvas"], pre, code'));
  }
  function resolveCanonicalChatGPTComposer(document) {
    if (!document?.querySelectorAll) return null;
    const shells = Array.from(document.querySelectorAll('form[data-type="unified-composer"]')).filter(isVisible);
    if (shells.length !== 1) return null;
    const shell = shells[0];
    if (isAssistantContent(shell) || isNonComposerSurface(shell)) return null;
    const candidates = Array.from(shell.querySelectorAll('#prompt-textarea[contenteditable="true"], textarea[name="prompt-textarea"]')).filter(candidate => isVisible(candidate) && !isAssistantContent(candidate) && !isNonComposerSurface(candidate));
    const richEditor = candidates.find(candidate => candidate.matches?.('#prompt-textarea[contenteditable="true"][role="textbox"]'));
    const composer = richEditor || (candidates.length === 1 ? candidates[0] : null);
    return composer && composer.closest?.('form[data-type="unified-composer"]') === shell ? composer : null;
  }
  function findActiveComposer(document) { return SELECTORS.composer.map(selector => Array.from(document.querySelectorAll(selector))).flat().find(isVisible) || null; }
  function findComposerSendButton(document, composer = resolveCanonicalChatGPTComposer(document)) {
    if (!composer) return null;
    const shell = composer.closest?.('form[data-type="unified-composer"]');
    if (!shell || isAssistantContent(shell) || isNonComposerSurface(shell)) return null;
    const scoped = shell?.querySelector?.('[data-testid="send-button"], #composer-submit-button, button[type="submit"]');
    return scoped && shell.contains?.(scoped) ? scoped : null;
  }
  function ownerConfirmSend(document, composer, mode) {
    if (mode !== COMPOSER_ACTION_MODES.OWNER_CONFIRM_SEND) return false;
    const sendButton = findComposerSendButton(document, composer);
    if (!sendButton || sendButton.disabled) return false;
    sendButton.click();
    return true;
  }
  function resolveConversationId(locationRef) {
    const pathname = String(locationRef?.pathname || (() => { try { return new URL(String(locationRef?.href || '')).pathname; } catch { return ''; } })());
    return pathname.match(/^\/c\/([^/?#]+)/)?.[1] || null;
  }
  function originContext(document, message, block) {
    const locationRef = document.location || root.location || { href: '', pathname: '' };
    const conversationId = resolveConversationId(locationRef);
    const messageId = message?.getAttribute?.('data-message-id') || message?.getAttribute?.('data-turn-id') || message?.id || message?.getAttribute?.('data-testid') || undefined;
    const blockId = block?.getAttribute?.('data-block-id') || block?.getAttribute?.('data-writing-block-id') || block?.id || undefined;
    return { conversationId, conversationUrl: locationRef.href, ...(messageId ? { messageId } : {}), ...(blockId ? { blockId } : {}) };
  }
  function addBridgeStyle(document) {
    if (document.querySelector('[data-aicc-bridge-style]')) return;
    const style = document.createElement('style'); style.dataset.aiccBridgeStyle = 'true';
    style.textContent = '.aicc-executable-action-rail,.aicc-composer-action-rail{position:fixed;z-index:2147483646;display:flex;align-items:center;gap:8px;pointer-events:none}.aicc-executable-action-rail button,.aicc-composer-action-rail button{pointer-events:auto}.aicc-executable-action-rail [data-aicc-action-error]{max-width:320px;padding:6px 8px;border:1px solid #fecaca;border-radius:7px;background:#fff1f2;color:#9f1239;font:500 12px/1.35 system-ui,-apple-system,sans-serif;pointer-events:auto}.aicc-assistant-action,.aicc-composer-action{box-sizing:border-box;font:500 12px/1 system-ui,-apple-system,sans-serif;cursor:pointer;transition:filter .15s ease,background .15s ease,transform .05s ease}.aicc-assistant-action{display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border:0;border-radius:7px;background:#6d3bd2;color:#fff;box-shadow:0 1px 2px #0002}.aicc-assistant-action:hover{filter:brightness(1.08)}.aicc-assistant-action:disabled{opacity:.72;cursor:wait}.aicc-assistant-action:active,.aicc-composer-action:active{transform:translateY(1px)}.aicc-composer-action{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid #3b82f6;border-radius:8px;background:#fff;color:#2563eb;white-space:nowrap}.aicc-composer-action:hover{background:#eff6ff}.aicc-bridge-icon{display:inline-block;color:inherit;font-size:13px;line-height:1;font-weight:700}.aicc-composer-action .aicc-bridge-icon{color:#2563eb}';
    document.head?.appendChild(style);
  }
  function bridgeButton(document, kind, label) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'aicc-composer-action'; button.dataset.aiccAction = kind;
    button.setAttribute('aria-label', label); if (kind === 'composer') { button.dataset.aiccComposerAction = 'true'; button.setAttribute('data-aicc-composer-action', 'true'); } button.innerHTML = '<span class="aicc-bridge-icon" aria-hidden="true">✦</span><span data-aicc-action-label>' + label + '</span>'; return button;
  }
  function clipboardSendButton(document) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'aicc-composer-action aicc-composer-clipboard-send'; button.dataset.aiccAction = 'clipboard-chatgpt-send'; button.dataset.aiccClipboardChatgptSend = 'true'; button.setAttribute('aria-label', 'Paste clipboard and send'); button.title = 'Paste clipboard and send'; button.textContent = '➡️'; return button;
  }
  function setActionLabel(button, label) { const target = button?.querySelector?.('[data-aicc-action-label]'); if (target) target.textContent = label; button?.setAttribute?.('aria-label', label); }
  function clearActionError(button) { const error = button?.parentElement?.querySelector?.('[data-aicc-action-error]'); if (error) error.remove(); }
  function invoke(onClick, button, ...args) {
    if (button?.disabled) return Promise.resolve(null);
    clearActionError(button); button.disabled = true; button.dataset.aiccState = 'SUBMITTING_LOCAL'; setActionLabel(button, 'AICC · 本地提交中');
    let result;
    try { result = onClick(...args); } catch (error) { result = Promise.reject(error); }
    return Promise.resolve(result).then(value => { const running = value?.item?.state === 'LAUNCHED' || value?.state === 'LAUNCHED'; button.dataset.aiccState = running ? 'RUNNING' : 'SUBMITTED'; setActionLabel(button, running ? 'AICC · 运行中' : 'AICC · 已提交'); return value; }).catch(error => { button.disabled = false; button.dataset.aiccState = 'ERROR'; setActionLabel(button, `AICC · ${error?.code || '失败'}`); button.title = `${error?.code || 'AICC_SUBMISSION_FAILED'} · ${error?.reason || error?.message || 'AICC 提交失败'}`; throw error; });
  }
  function invokeClipboardSend(onClick, button) {
    if (button?.disabled) return Promise.resolve(null);
    button.disabled = true; button.dataset.aiccClipboardState = 'READING'; button.setAttribute('aria-busy', 'true'); button.title = 'Paste clipboard and send · Reading clipboard';
    let result;
    try { result = onClick(); } catch (error) { result = Promise.reject(error); }
    return Promise.resolve(result).then(value => { button.dataset.aiccClipboardState = 'IDLE'; button.disabled = false; button.setAttribute('aria-busy', 'false'); button.title = 'Paste clipboard and send'; return value; }).catch(error => { const reason = error?.reason || error?.message || 'Clipboard action failed'; button.dataset.aiccClipboardState = 'ERROR'; button.disabled = false; button.setAttribute('aria-busy', 'false'); button.title = `Paste clipboard and send · ${error?.code ? `${error.code} · ${reason}` : reason}`; throw error; });
  }
  function stableSurfaceHash(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); }
    return (hash >>> 0).toString(36);
  }
  function selectedPayload(document, selection) {
    if (!selection || !String(selection.toString?.() || '').trim()) return null;
    const anchor = selection.anchorNode?.nodeType === 1 ? selection.anchorNode : selection.anchorNode?.parentElement;
    const focus = selection.focusNode?.nodeType === 1 ? selection.focusNode : selection.focusNode?.parentElement;
    if (!anchor || !focus) return null;
    const messages = [...assistantMessages(document), ...userMessages(document)];
    for (const message of messages) {
      if (message.contains?.(anchor) && message.contains?.(focus)) return { text: String(selection.toString()), originContext: originContext(document, message), message, surface: null };
    }
    return null;
  }
  function mountComposerAiccAction(document, onClick) {
    try { console.log('[AICC composer mount] caller entered'); } catch {}
    addBridgeStyle(document);
    const target = findActiveComposer(document); try { console.log('[AICC composer mount] target', target ? { tag: target.tagName, id: target.id || '', class: target.className || '', connected: Boolean(target.isConnected) } : null); } catch {}
    if (!target) return;
    let scope = target.parentElement, send = null;
    for (let depth = 0; scope && depth < 5; depth += 1, scope = scope.parentElement) { send = scope.querySelector?.('button[data-testid*="send"],button[aria-label*="Send"],button[aria-label*="发送"]'); if (send) break; }
    try { console.log('[AICC composer mount] send found', Boolean(send)); } catch {}
    const allRails = Array.from(document.querySelectorAll('[data-aicc-composer-rail]'));
    try { console.log('[AICC composer mount] rail before', allRails.length); } catch {}
    const composerKey = target.id || target.getAttribute?.('data-testid') || 'active';
    const existing = allRails.find(rail => rail.dataset.aiccComposerFor === composerKey);
    allRails.filter(rail => rail !== existing).forEach(rail => rail.remove());
    if (existing) { positionFloatingAction(document, existing, send || target, 'left'); return; }
    const button = bridgeButton(document, 'composer', 'AICC 执行');
    button.__aiccComposer = target;
    button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); const current = findActiveComposer(document); if (!current) return; invoke(onClick, button, String(textOf(current) || '').trim(), originContext(document, null), null).catch(() => {}); });
    const rail = document.createElement('div'); rail.className = 'aicc-composer-action-rail'; rail.dataset.aiccComposerRail = 'true'; rail.dataset.aiccComposerFor = composerKey;
    rail.appendChild(button); document.body.appendChild(rail); positionFloatingAction(document, rail, send || target, 'left');
    try { console.log('[AICC composer mount] rail after', document.querySelectorAll('[data-aicc-composer-rail]').length); console.log('[AICC composer mount] button after', document.querySelectorAll('[data-aicc-composer-action="true"]').length); console.log('[AICC composer mount] rect', rail.getBoundingClientRect?.()); } catch {}
  }
  root.AICCChatGPTDom = Object.freeze({ SELECTORS, BridgeRuntimeState, BridgeResultState, BridgeExecutionSource, COMPOSER_ACTION_MODES, SUBMISSION_ACK_TIMEOUT_MS, normalizeProtocolText: normalizedText, submissionPayloadHash, assistantMessages, userMessages, assistantMessageIdentity, userMessageIdentity, submittedUserMessage, submittedUserMessageIdentity, liveComposerSendCondition, waitForLiveComposerSendCondition, waitForSubmittedUserMessage, submitChatGPTComposerOnce, removeChatContentFloatingButtons, selectedPayload, resolveConversationId, originContext, mountComposerAiccAction, insertTextIntoComposer, copyAndInsertResultArtifact, bridgeExecutionSource, canonicalResultText, bridgeReportText, emptyBridgeRuntimeProjection, newSubmissionId, extensionContextUsable, durableAck, hasExecutionIdentity, recoverBridgeRuntimeProjection, projectBridgeRuntime, verifyComposerText, reportFormatPresent, textOf, resolveCanonicalChatGPTComposer, findActiveComposer, findComposerSendButton, ownerConfirmSend });
}(typeof window === 'undefined' ? globalThis : window));
