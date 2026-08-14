(function (root) {
  'use strict';
  const SELECTORS = Object.freeze({
    assistant: '[data-message-author-role="assistant"]',
    composer: '[contenteditable="true"],textarea'
  });
  const BLOCK = /AICC_EXECUTION_V1[ \t]*\n[\s\S]*?\nINSTRUCTION_END(?=\n|$)/g;
  function textOf(node) { return !node ? '' : 'value' in node ? node.value || '' : node.innerText || node.textContent || ''; }
  function normalize(value) { return String(value || '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n'); }
  function extractProtocolBlocks(value) { const source = normalize(value); const blocks = []; BLOCK.lastIndex = 0; let match; while ((match = BLOCK.exec(source))) blocks.push(match[0].trim()); return blocks; }
  function completeProtocol(value) { const blocks = extractProtocolBlocks(value); return blocks.length === 1 ? { block: blocks[0], error: null } : { block: null, error: blocks.length > 1 ? 'AMBIGUOUS_INSTRUCTION' : 'NO_COMPLETE_INSTRUCTION' }; }
  function targetInstruction(document) {
    const candidates = Array.from(document.querySelectorAll(SELECTORS.assistant));
    const matches = candidates.map(message => ({ message, result: completeProtocol(textOf(message)) })).filter(candidate => candidate.result.error === null);
    return matches.length === 1 ? { ...matches[0].result, message: matches[0].message } : { block: null, message: null, error: matches.length > 1 ? 'AMBIGUOUS_INSTRUCTION' : 'NO_COMPLETE_INSTRUCTION' };
  }
  function conversationContext(document, message) { const locationRef = document.location || root.location || { href: '' }; const id = message?.getAttribute?.('data-message-id') || message?.id; const conversationId = (locationRef.pathname || '').match(/\/c\/([^/]+)/)?.[1] || locationRef.href; return { conversationId, conversationUrl: locationRef.href, ...(id ? { messageId: id } : {}) }; }
  function reportFormatPresent(node, runId) { return normalize(textOf(node)).includes(`AICC_RUN_REPORT_V1\nRun ID: ${runId}`); }
  function insertReport(node, text) { if (!node || !text) return false; if (reportFormatPresent(node, text.match(/Run ID: ([^\n]+)/)?.[1] || '')) return false; node.focus?.(); const existing = textOf(node); const value = `${existing}${existing && !/[\n\r]$/.test(existing) ? '\n\n' : ''}${text}`; if ('value' in node) node.value = value; else node.textContent = value; node.dispatchEvent?.(new Event('input', { bubbles: true })); return reportFormatPresent(node, text.match(/Run ID: ([^\n]+)/)?.[1] || ''); }
  root.AICCBridgeV2Dom = Object.freeze({ SELECTORS, textOf, normalize, extractProtocolBlocks, completeProtocol, targetInstruction, conversationContext, reportFormatPresent, insertReport });
}(typeof window === 'undefined' ? globalThis : window));
