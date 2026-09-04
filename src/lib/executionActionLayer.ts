export type ExecutionActionLayer = {
  pasteInstruction: (payload?: string) => Promise<unknown> | unknown;
  importInstruction: (payload?: string) => Promise<unknown> | unknown;
  importAndRun: (payload?: string, metadata?: {model?: string}) => Promise<unknown> | unknown;
  executeCurrentInstruction: () => Promise<unknown> | unknown;
  copyResult: () => Promise<unknown> | unknown;
  getExecution: (executionId: string) => unknown;
  getResult: (executionId: string) => unknown;
};

export function createExecutionActionLayer(deps: Omit<ExecutionActionLayer, 'importAndRun'> & {
  importInstruction: (payload?: string) => Promise<any>;
  executeImported: (item: any, metadata?: {model?: string}) => Promise<any>;
}): ExecutionActionLayer {
  return { ...deps, importAndRun: async (payload, metadata) => deps.executeImported(await deps.importInstruction(payload), metadata) };
}

export function matchesMacShortcut(event: KeyboardEvent, key: string): boolean {
  return event.metaKey && event.altKey && !event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === key.toLowerCase();
}

export function registerMacShortcuts(layer: ExecutionActionLayer, target: Window = window): () => void {
  const handler = (event: KeyboardEvent) => {
    const action = matchesMacShortcut(event, 'v') ? layer.pasteInstruction : matchesMacShortcut(event, 'r') ? layer.importAndRun : matchesMacShortcut(event, 'c') ? layer.copyResult : null;
    if (!action) return;
    event.preventDefault();
    void action();
  };
  target.addEventListener('keydown', handler);
  return () => target.removeEventListener('keydown', handler);
}
