export type AdapterFetch = (input: string, init?: RequestInit) => Promise<Response>;

export type AdapterStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
};

export type AdapterCorrelation = {
  instructionId?: string;
  inboxId: string;
  runId?: string;
  sourceReference?: string;
  originContext?: { conversationId?: string; conversationUrl?: string; messageId?: string };
  sentAt: string;
};

export type AdapterInboxItem = {
  id: string;
  state: string;
  instruction?: { instructionId?: string; entityId?: string; executionType?: string };
  error?: string;
  parseErrors?: string[];
};

export type AdapterReport = {
  version?: string;
  inboxId?: string;
  executionId?: string;
  runId?: string;
  entityId?: string;
  workPackageId?: string;
  executionType?: string;
  runtimeResult?: string;
  gateResult?: string;
  summary?: string;
  [key: string]: unknown;
};

export type AdapterOutboxItem = {
  id: string;
  state: string;
  inboxId: string;
  runId?: string;
  report?: AdapterReport;
};

export type AdapterFailure = {
  code: string;
  state: 'ERROR' | 'BLOCKED';
  reason: string;
  nextAction: string;
};

const CORRELATION_KEY = 'aicc-gpt-bridge-adapter-correlation-v1';

export function failureFrom(code: string, reason: string, nextAction: string, state: AdapterFailure['state'] = 'ERROR'): AdapterFailure {
  return { code, state, reason, nextAction };
}

export function restoreCorrelation(storage: AdapterStorage | undefined): AdapterCorrelation | null {
  try {
    const raw = storage?.getItem(CORRELATION_KEY);
    return raw ? JSON.parse(raw) as AdapterCorrelation : null;
  } catch {
    return null;
  }
}

export function persistCorrelation(storage: AdapterStorage | undefined, correlation: AdapterCorrelation): void {
  try { storage?.setItem(CORRELATION_KEY, JSON.stringify(correlation)); } catch { /* adapter state is recoverable through the fallback */ }
}

export function clearCorrelation(storage: AdapterStorage | undefined): void {
  try { storage?.removeItem?.(CORRELATION_KEY); } catch { /* storage is optional */ }
}

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  try { return await response.json() as Record<string, unknown>; }
  catch { return {}; }
}

function httpFailure(status: number): AdapterFailure {
  return failureFrom(`AICC_HTTP_${status}`, 'AICC 本地服务未接受请求。', '确认 AICC 本地服务已启动后重试。');
}

export class WebBridgeClient {
  private readonly fetchImpl: AdapterFetch;
  private readonly storage?: AdapterStorage;
  private readonly baseUrl: string;

  constructor(options: { baseUrl?: string; fetchImpl?: AdapterFetch; storage?: AdapterStorage } = {}) {
    this.baseUrl = (options.baseUrl ?? 'http://127.0.0.1:1420').replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.storage = options.storage;
  }

  async sendInstruction(text: string, sourceReference?: string, originContext?: AdapterCorrelation['originContext']): Promise<{ item: AdapterInboxItem; correlation: AdapterCorrelation }> {
    if (!text.trim()) throw failureFrom('INSTRUCTION_TEXT_REQUIRED', '没有找到可发送的任务内容。', '在 ChatGPT 编辑框中输入任务后重试。');
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/api/gpt-bridge/inbox`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: text, sourceType: 'WEB_BRIDGE', sourceReference, originContext })
      });
    } catch {
      throw failureFrom('AICC_UNAVAILABLE', '无法连接 AICC 本地服务。', '确认 127.0.0.1:1420 可用后重试。');
    }
    const body = await responseBody(response);
    if (!response.ok) throw httpFailure(response.status);
    const item = body.item as AdapterInboxItem | undefined;
    if (!item?.id) throw failureFrom('INBOX_RESPONSE_INVALID', 'AICC 返回了无法识别的 Inbox 结果。', '检查本地服务日志后重试。');
    if (item.state === 'INVALID') throw failureFrom('INVALID_EXECUTION_INSTRUCTION', item.parseErrors?.[0] ?? item.error ?? 'AICC_EXECUTION_V1 指令无效。', '修正指令格式后重新发送。', 'BLOCKED');
    const correlation: AdapterCorrelation = {
      inboxId: item.id,
      instructionId: item.instruction?.instructionId,
      sourceReference,
      originContext,
      sentAt: new Date().toISOString()
    };
    persistCorrelation(this.storage, correlation);
    return { item, correlation };
  }

  async pollMatchingResult(correlation: AdapterCorrelation | null = restoreCorrelation(this.storage)): Promise<AdapterOutboxItem | null> {
    if (!correlation) return null;
    let response: Response;
    try { response = await this.fetchImpl(`${this.baseUrl}/api/gpt-bridge/outbox`); }
    catch { throw failureFrom('AICC_UNAVAILABLE', '无法读取 AICC 运行结果。', '确认本地服务可用后重试。'); }
    if (!response.ok) throw httpFailure(response.status);
    const body = await responseBody(response);
    const items = Array.isArray(body.items) ? body.items as AdapterOutboxItem[] : [];
    const match = items.find(item => item.inboxId === correlation.inboxId && (!correlation.runId || item.runId === correlation.runId));
    if (match?.runId && !correlation.runId) persistCorrelation(this.storage, { ...correlation, runId: match.runId });
    return match ?? null;
  }
}

export function reportForComposer(item: AdapterOutboxItem): string {
  const report = item.report ?? {};
  return [
    'AICC_RUN_REPORT_V1',
    `Run ID: ${report.runId ?? item.runId ?? 'ABSENT'}`,
    `Entity: ${report.entityId ?? 'ABSENT'}`,
    `Execution type: ${report.executionType ?? 'UNAVAILABLE'}`,
    '',
    `Runtime Result: ${report.runtimeResult ?? 'UNAVAILABLE'}`,
    `Gate Result: ${report.gateResult ?? 'UNAVAILABLE'}`,
    '',
    'Summary:',
    `${report.summary ?? 'UNAVAILABLE'}`
  ].join('\n');
}

export type ComposerElement = {
  value?: string;
  textContent?: string | null;
  innerText?: string;
  ownerDocument?: { execCommand?: (command: string, showUi?: boolean, value?: string) => boolean };
  dispatchEvent?: (event: Event) => boolean;
  focus?: () => void;
};

export type ComposerRoot = { querySelector(selector: string): ComposerElement | null };

export function insertIntoComposer(text: string, root: ComposerRoot, eventFactory: () => Event = () => new Event('input', { bubbles: true })): boolean {
  const composer = root.querySelector('[contenteditable="true"]') ?? root.querySelector('textarea') ?? root.querySelector('input');
  if (!composer) return false;
  composer.focus?.();
  if ('value' in composer) composer.value = `${composer.value ?? ''}${composer.value ? '\n\n' : ''}${text}`;
  else if (composer.ownerDocument?.execCommand) {
    const inserted = composer.ownerDocument.execCommand('insertText', false, text);
    if (inserted === false) return false;
  } else return false;
  composer.dispatchEvent?.(eventFactory());
  return true;
}

export const WEB_ADAPTER_CONTRACT = {
  transport: 'TEXT_ONLY',
  autoExecuteOnReceive: false,
  autoSendChatGptMessage: false,
  conversationMetadataAuthority: true,
  localService: 'http://127.0.0.1:1420',
  fallback: 'CLIPBOARD_COPY_PASTE'
} as const;
