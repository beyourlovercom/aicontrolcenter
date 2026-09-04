(function (root) {
  'use strict';

  const ICONS = Object.freeze({
    clipboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="12" height="16" rx="2"/><path d="M9 5V3h6v2"/></svg>',
    execute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none"/></svg>',
    insert: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 16v3h14v-3"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9a4.5 4.5 0 0 0 1 9Z" fill="currentColor" stroke="none"/><path d="M12 16V10m0 0-3 3m3-3 3 3" stroke="#10213b"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>'
  });

  const ACTION_SPECS = Object.freeze([
    { actionKey: 'us-claude', displayOrdinal: 0, label: 'US-Claude', capability: 'us-claude', icon: ICONS.execute },
    { actionKey: 'clipboard-codex-execute', displayOrdinal: 1, label: '剪贴板发送到 Codex 执行', capability: 'clipboard-codex-execute', icon: ICONS.clipboard },
    { actionKey: 'codex-execute', displayOrdinal: 2, label: '发送到 Codex 并执行', capability: 'codex-execute', icon: ICONS.execute },
    { actionKey: 'codex-result', displayOrdinal: 3, label: '插入 Codex 结果', capability: 'codex-result', icon: ICONS.insert },
    { actionKey: 'aicc-send', displayOrdinal: 4, label: '发送到 AICC', capability: 'aicc-send', icon: ICONS.send },
    { actionKey: 'next-step', displayOrdinal: 5, label: '执行下一步', capability: 'next-step', icon: ICONS.next }
  ]);

  function validateBridgeActionRegistry(registry) {
    const actions = Object.values(registry);
    if (new Set(actions.map(action => action.actionKey)).size !== actions.length) throw new Error('DUPLICATE_ACTION_KEY');
    const visible = actions.filter(action => action.visible);
    if (new Set(visible.map(action => action.displayOrdinal)).size !== visible.length) throw new Error('DUPLICATE_VISIBLE_ORDINAL');
    for (const action of visible) {
      if (!action.label?.trim()) throw new Error('VISIBLE_ACTION_LABEL_REQUIRED');
      if (typeof action.handler !== 'function') throw new Error(`VISIBLE_ACTION_WITHOUT_HANDLER:${action.actionKey}`);
      if (!action.enabled && !action.disabledReason?.trim()) throw new Error(`DISABLED_WITHOUT_REASON:${action.actionKey}`);
    }
    return registry;
  }

  function createBridgeActionRegistry({ handlers, capabilityResolver }) {
    const registry = Object.fromEntries(ACTION_SPECS.map(spec => {
      const capability = capabilityResolver(spec.actionKey) || { enabled: true, disabledReason: '' };
      return [spec.actionKey, Object.freeze({
        ...spec,
        visible: true,
        enabled: Boolean(capability.enabled),
        disabledReason: capability.enabled ? '' : String(capability.disabledReason || ''),
        handler: handlers[spec.actionKey],
        testIdentity: `bridge-primary-${spec.actionKey}`
      })];
    }));
    return validateBridgeActionRegistry(registry);
  }

  function renderBridgeAction(action) {
    const disabled = action.enabled ? '' : ' disabled aria-disabled="true"';
    const title = action.enabled ? action.label : `${action.label} · ${action.disabledReason}`;
    return `<button type="button" data-aicc-action-button="true" data-aicc-action-key="${action.actionKey}" data-aicc-test-identity="${action.testIdentity}" title="${title}"${disabled}><span class="aicc-action-number">${action.displayOrdinal}</span><span class="aicc-action-icon">${action.icon}</span><span class="aicc-action-label" data-aicc-action-label>${action.label}</span></button>`;
  }

  root.AICCBridgeActionRegistry = Object.freeze({ ACTION_SPECS, createBridgeActionRegistry, renderBridgeAction, validateBridgeActionRegistry });
})(window);
