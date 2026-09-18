import assert from 'node:assert/strict';
import { displayMessages, readChatgptSnapshots, snapshotForConversation, type ChatgptConversationSnapshot } from './chatgptProjection.ts';

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

const humanized = displayMessages([
  { messageId: 'u1', role: 'user', text: 'AICC V5.4 NEXT-STEP REQUEST\nowner_draft: 全部pass' },
  { messageId: 'a1', role: 'assistant', text: 'AICC_NEXT_STEP_V1\nAICC_DECISION: EXECUTE\nAICC_ACTION_CLASS: TEST_ONLY\nAICC_PROVIDER: CLAUDE_CODE\nAICC_TASK: Diagnose CI\nAICC_GATE_REASON: NONE' },
  { messageId: 'a2', role: 'assistant', text: 'normal answer' }
]);
assert.deepEqual(humanized.map((m) => [m.label, m.text]), [
  ['Owner · AICC', '全部pass'],
  ['AICC · Planner', 'TEST_ONLY → CLAUDE_CODE → Diagnose CI'],
  ['ChatGPT · Chrome', 'normal answer']
]);
console.log('chatgptProjection.test.ts PASS');
