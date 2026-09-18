import assert from 'node:assert/strict';
import { readChatgptSnapshots, snapshotForConversation, type ChatgptConversationSnapshot } from './chatgptProjection.ts';

const snapshots: ChatgptConversationSnapshot[] = [{
  provider: 'chatgpt-web', conversationId: 'c1', conversationUrl: 'https://chatgpt.com/c/c1', title: 'One', tabId: 1,
  capturedAt: '2026-09-14T02:00:00.000Z', messages: [{ messageId: 'm1', role: 'assistant', text: 'hello' }]
}];
assert.equal(snapshotForConversation(snapshots, 'c1')?.title, 'One');
assert.equal(snapshotForConversation(snapshots, 'missing'), null);
const fakeFetch = async () => new Response(JSON.stringify({ available: true, provider: 'chatgpt-web', snapshots }), { status: 200, headers: { 'content-type': 'application/json' } });
assert.equal((await readChatgptSnapshots(fakeFetch as typeof fetch)).length, 1);
const badFetch = async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
await assert.rejects(() => readChatgptSnapshots(badFetch as typeof fetch), /CHATGPT_PROJECTION_INVALID/);

console.log('chatgptProjection.test.ts PASS');
