export type ChatgptProjectedMessage = {
  messageId: string;
  role: 'user' | 'assistant';
  text: string;
};


export function filterAiccTranscriptText(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '已调用工具')
    .join('\n');
}

export function aiccVisibleMessages(messages: ChatgptProjectedMessage[]): ChatgptProjectedMessage[] {
  return messages
    .map((message) => ({ ...message, text: filterAiccTranscriptText(message.text) }))
    .filter((message) => message.text.trim().length > 0);
}

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
