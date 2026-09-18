export type ChatgptProjectedMessage = {
  messageId: string;
  role: 'user' | 'assistant';
  text: string;
};

export type ChatgptConversationSnapshot = {
  provider: 'chatgpt-web';
  conversationId: string;
  conversationUrl: string;
  title: string;
  tabId: number | null;
  capturedAt: string;
  messages: ChatgptProjectedMessage[];
};

export type ChatgptProjectionResponse = {
  available: boolean;
  provider: 'chatgpt-web';
  snapshots: ChatgptConversationSnapshot[];
};

export async function readChatgptSnapshots(
  fetcher: typeof fetch = fetch,
  endpoint = '/api/chatgpt/snapshots'
): Promise<ChatgptConversationSnapshot[]> {
  const response = await fetcher(endpoint, { headers: { accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`CHATGPT_PROJECTION_HTTP_${response.status}`);
  const body = await response.json() as Partial<ChatgptProjectionResponse>;
  if (!body.available || !Array.isArray(body.snapshots)) throw new Error('CHATGPT_PROJECTION_INVALID');
  return body.snapshots.filter((snapshot): snapshot is ChatgptConversationSnapshot =>
    snapshot?.provider === 'chatgpt-web' && typeof snapshot.conversationId === 'string' && typeof snapshot.conversationUrl === 'string' && Array.isArray(snapshot.messages)
  );
}

export function snapshotForConversation(
  snapshots: ChatgptConversationSnapshot[],
  conversationId: string | null
): ChatgptConversationSnapshot | null {
  if (!conversationId) return null;
  return snapshots.find((snapshot) => snapshot.conversationId === conversationId) ?? null;
}

export type ChatgptDisplayMessage = {
  messageId: string;
  role: 'user' | 'assistant';
  label: string;
  text: string;
  machineTransport: boolean;
};

function displayMarker(text: string, name: string): string | null {
  const match = text.match(new RegExp('^' + name + '\s*:\s*(.*)$', 'mi'));
  return match?.[1]?.trim() ?? null;
}

export function displayMessages(messages: ChatgptProjectedMessage[]): ChatgptDisplayMessage[] {
  const visible: ChatgptDisplayMessage[] = [];
  for (const message of messages) {
    const text = message.text.trim();
    if (message.role === 'user' && text.includes('AICC V5.4 NEXT-STEP REQUEST')) {
      const draft = displayMarker(text, 'owner_draft');
      if (draft && draft !== '(none)') visible.push({ messageId: message.messageId, role: 'user', label: 'Owner · AICC', text: draft, machineTransport: true });
      continue;
    }
    if (message.role === 'assistant' && text.includes('AICC_NEXT_STEP_V1')) {
      const decision = displayMarker(text, 'AICC_DECISION');
      const action = displayMarker(text, 'AICC_ACTION_CLASS');
      const provider = displayMarker(text, 'AICC_PROVIDER');
      const task = displayMarker(text, 'AICC_TASK');
      const gate = displayMarker(text, 'AICC_GATE_REASON');
      const parts = decision === 'STOP_GATE' ? ['STOP Gate', gate && gate !== 'NONE' ? gate : null] : [action, provider, task];
      visible.push({ messageId: message.messageId, role: 'assistant', label: 'AICC · Planner', text: parts.filter(Boolean).join(' → ') || 'Planner decision received', machineTransport: true });
      continue;
    }
    visible.push({ messageId: message.messageId, role: message.role, label: message.role === 'user' ? 'You · Chrome' : 'ChatGPT · Chrome', text: message.text, machineTransport: false });
  }
  return visible;
}
