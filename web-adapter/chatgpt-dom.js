(function (root) {
  'use strict';
  const SELECTORS = Object.freeze({
    assistant: [
      '[data-message-author-role="assistant"]',
      '[data-testid*="conversation-turn"] [data-message-author-role="assistant"]',
      'article[data-message-author-role="assistant"]'
    ],
    composer: ['[contenteditable="true"]', 'textarea']
  });
  const BLOCK = /AICC_EXECUTION_V1[ \t]*\n[\s\S]*?\nINSTRUCTION_END(?=\n|$)/g;

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
  function extractProtocolBlocks(text) {
    const blocks = [];
    const source = normalizedText(text);
    let match;
    BLOCK.lastIndex = 0;
    while ((match = BLOCK.exec(source))) blocks.push(match[0].trim());
    return blocks;
  }
  function completeProtocol(text) {
    const blocks = extractProtocolBlocks(text);
    return blocks.length === 1 ? { block: blocks[0], error: null } : { block: null, error: blocks.length > 1 ? 'AMBIGUOUS_INSTRUCTION' : 'NO_COMPLETE_INSTRUCTION' };
  }
  function assistantMessages(document) {
    for (const selector of SELECTORS.assistant) {
      const nodes = Array.from(document.querySelectorAll(selector));
      if (nodes.length) return nodes;
    }
    return [];
  }
  function isExecutableSurface(message) {
    if (!message?.querySelector) return false;
    const surface = message.querySelector('[data-writing-block], [data-testid*="writing-block"], [data-testid*="writing_block"], pre, code, [contenteditable="true"]');
    return Boolean(surface && String(textOf(surface) || '').trim());
  }
  function executableSurface(message) {
    if (!message?.querySelector) return null;
    const selectors = ['[data-writing-block]', '[data-testid*="writing-block"]', '[data-testid*="writing_block"]', 'pre', 'code'];
    return selectors.map(selector => Array.from(message.querySelectorAll(selector))).flat().find(node => String(textOf(node) || '').trim()) || null;
  }
  function actionContainerFor(message) {
    const copy = Array.from(message.querySelectorAll?.('button') || []).find(button => /copy|复制/i.test(button.getAttribute?.('aria-label') || button.getAttribute?.('title') || button.textContent || ''));
    return copy?.parentElement || null;
  }
  function appendAssistantAction(document, message, button) {
    const container = actionContainerFor(message); if (!container) return false;
    const copy = Array.from(container.querySelectorAll?.('button') || []).find(candidate => /copy|复制/i.test(candidate.getAttribute?.('aria-label') || candidate.getAttribute?.('title') || candidate.textContent || ''));
    if (!copy) return false;
    container.insertBefore(button, copy); return true;
  }
  function isVisible(node) {
    if (!node || node.isConnected === false) return false;
    if (typeof node.getClientRects !== 'function' && typeof node.offsetParent === 'undefined') return true;
    return node.offsetParent !== null || Boolean(node.getClientRects?.().length);
  }
  function findActiveComposer(document) {
    return SELECTORS.composer.map(selector => Array.from(document.querySelectorAll(selector))).flat().find(isVisible) || null;
  }
  function invoke(onClick, button, ...args) {
    try { return Promise.resolve(onClick(...args)).catch(error => { button.dataset.aiccState = 'ERROR'; button.title = error?.reason || error?.message || 'AICC 提交失败'; console.error('[AICC] submission failed', error); }); }
    catch (error) { button.dataset.aiccState = 'ERROR'; button.title = error?.reason || error?.message || 'AICC 提交失败'; console.error('[AICC] submission failed', error); return Promise.resolve(); }
  }
  function originContext(document, message) {
    const locationRef = document.location || root.location || { href: '', pathname: '' };
    const conversationNode = document.querySelector('[data-conversation-id], [data-testid*="conversation"]');
    const conversationId = conversationNode?.getAttribute?.('data-conversation-id') || (locationRef.pathname || '').match(/\/c\/([^/]+)/)?.[1] || locationRef.href;
    const messageId = message?.getAttribute?.('data-message-id') || message?.getAttribute?.('data-turn-id') || message?.id || message?.getAttribute?.('data-testid') || undefined;
    return { conversationId, conversationUrl: locationRef.href, ...(messageId ? { messageId } : {}) };
  }
  function resolveTaskSource(document, explicitSelection) {
    const selected = String(explicitSelection || '').trim();
    if (selected) return { source: 'Selected Text', text: selected, message: null };
    const composer = document.querySelector(SELECTORS.composer.join(','));
    const composerText = String(textOf(composer) || '').trim();
    if (composerText) return { source: 'Composer', text: composerText, message: null };
    const messages = assistantMessages(document);
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const text = String(textOf(messages[index]) || '').trim();
      if (text) return { source: 'Assistant', text, message: messages[index] };
    }
    return { source: 'Composer', text: '', message: null };
  }
  function addBridgeStyle(document) {
    if (document.querySelector('[data-aicc-bridge-style]')) return;
    const style = document.createElement('style'); style.dataset.aiccBridgeStyle = 'true';
    style.textContent = '.aicc-assistant-action,.aicc-composer-action{box-sizing:border-box;font:500 12px/1 system-ui,-apple-system,sans-serif;cursor:pointer;transition:filter .15s ease,background .15s ease,transform .05s ease}.aicc-assistant-action{display:inline-flex;align-items:center;gap:5px;margin-left:6px;padding:6px 10px;border:0;border-radius:7px;background:#6d3bd2;color:#fff;box-shadow:0 1px 2px #0002}.aicc-assistant-action:hover{filter:brightness(1.08)}.aicc-assistant-action:active,.aicc-composer-action:active{transform:translateY(1px)}.aicc-composer-action{display:inline-flex;align-items:center;gap:6px;margin:0 6px 0 0;padding:8px 12px;border:1px solid #3b82f6;border-radius:8px;background:#fff;color:#2563eb}.aicc-composer-action:hover{background:#eff6ff}.aicc-bridge-icon{display:inline-block;color:inherit;font-size:13px;line-height:1;font-weight:700}.aicc-composer-action .aicc-bridge-icon{color:#2563eb}';
    document.head?.appendChild(style);
  }
  function bridgeButton(document, kind, label) {
    const button = document.createElement('button'); button.type = 'button'; button.className = kind === 'assistant' ? 'aicc-assistant-action' : 'aicc-composer-action'; button.dataset.aiccAction = kind;
    button.setAttribute('aria-label', label); if (kind === 'composer') button.dataset.aiccComposerAction = 'true'; button.innerHTML = '<span class="aicc-bridge-icon" aria-hidden="true">✦</span><span>' + label + '</span>'; return button;
  }
  function mountAssistantAiccActions(document, onClick) {
    addBridgeStyle(document);
    assistantMessages(document).forEach(message => {
      if (!isExecutableSurface(message) || message.querySelector('[data-aicc-action="assistant"]')) return;
      const button = bridgeButton(document, 'assistant', 'AICC'); button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); const surface = executableSurface(message); invoke(onClick, button, textOf(surface).trim(), originContext(document, message), message); });
      appendAssistantAction(document, message, button);
    });
  }
  function mountComposerAiccAction(document, onClick) {
    addBridgeStyle(document);
    const target = findActiveComposer(document); if (!target) return;
    let scope = target.parentElement, send = null;
    for (let depth = 0; scope && depth < 5; depth += 1, scope = scope.parentElement) { send = scope.querySelector?.('button[data-testid*="send"],button[aria-label*="Send"],button[aria-label*="发送"]'); if (send) break; }
    const allActions = Array.from(document.querySelectorAll('[data-aicc-composer-action]'));
    const existing = allActions.find(action => target.parentElement?.contains(action) && action.isConnected);
    allActions.filter(action => action !== existing).forEach(action => action.remove());
    if (existing) return;
    const container = send?.parentElement || target.parentElement; if (!container) return;
    const button = bridgeButton(document, 'composer', 'AICC 执行'); button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); const current = findActiveComposer(document); invoke(onClick, button, String(textOf(current) || '').trim(), originContext(document, null), null); });
    if (send) container.insertBefore(button, send); else container.appendChild(button);
  }
  function resolveInstructionSource(document, explicitSelection) {
    const selected = completeProtocol(explicitSelection);
    if (explicitSelection && selected.error === null) return { source: 'Selected Text', block: selected.block, error: null };
    if (explicitSelection && selected.error === 'AMBIGUOUS_INSTRUCTION') return { source: 'Selected Text', block: null, error: selected.error };
    const composer = document.querySelector(SELECTORS.composer.join(','));
    const currentComposer = completeProtocol(textOf(composer));
    if (currentComposer.error === null) return { source: 'Composer', block: currentComposer.block, error: null };
    if (currentComposer.error === 'AMBIGUOUS_INSTRUCTION') return { source: 'Composer', block: null, error: currentComposer.error };
    const messages = assistantMessages(document);
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const candidate = completeProtocol(textOf(messages[index]));
      if (candidate.error === null) return { source: 'Assistant', block: candidate.block, error: null };
      if (candidate.error === 'AMBIGUOUS_INSTRUCTION') return { source: 'Assistant', block: null, error: candidate.error };
    }
    return { source: 'Assistant', block: null, error: currentComposer.error };
  }
  root.AICCChatGPTDom = Object.freeze({ SELECTORS, normalizeProtocolText: normalizedText, extractProtocolBlocks, completeProtocol, assistantMessages, isExecutableSurface, resolveInstructionSource, resolveTaskSource, originContext, mountAssistantAiccActions, mountComposerAiccAction, insertTextIntoComposer, verifyComposerText, reportFormatPresent, textOf, findActiveComposer });
}(typeof window === 'undefined' ? globalThis : window));
