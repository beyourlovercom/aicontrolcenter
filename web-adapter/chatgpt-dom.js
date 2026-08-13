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
  const BLOCK = /AICC_EXECUTION_V1[\s\S]*?INSTRUCTION_BEGIN\n[\s\S]*?\nINSTRUCTION_END/g;

  function textOf(node) { return node ? ('value' in node ? node.value : node.innerText || node.textContent || '') : ''; }
  function extractProtocolBlocks(text) {
    const blocks = [];
    const source = String(text || '').replace(/\r/g, '');
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
  function resolveInstructionSource(document, explicitSelection) {
    const selected = completeProtocol(explicitSelection);
    if (explicitSelection && selected.error === null) return { source: 'Selected Text', block: selected.block, error: null };
    if (explicitSelection && selected.error === 'AMBIGUOUS_INSTRUCTION') return { source: 'Selected Text', block: null, error: selected.error };
    const messages = assistantMessages(document);
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const candidate = completeProtocol(textOf(messages[index]));
      if (candidate.error === null) return { source: 'Assistant', block: candidate.block, error: null };
      if (candidate.error === 'AMBIGUOUS_INSTRUCTION') return { source: 'Assistant', block: null, error: candidate.error };
    }
    const composer = document.querySelector(SELECTORS.composer.join(','));
    const fallback = completeProtocol(textOf(composer));
    if (fallback.error === null) return { source: 'Composer', block: fallback.block, error: null };
    return { source: 'Composer', block: null, error: fallback.error };
  }
  root.AICCChatGPTDom = Object.freeze({ SELECTORS, extractProtocolBlocks, completeProtocol, assistantMessages, resolveInstructionSource });
}(typeof window === 'undefined' ? globalThis : window));
