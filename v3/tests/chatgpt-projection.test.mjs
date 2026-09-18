import assert from 'node:assert/strict';
import {conversationIdentity,createChatgptProjectionStore,normalizeChatgptSnapshot} from '../lib/chatgpt-projection.mjs';

const id=conversationIdentity('https://chatgpt.com/c/abc-123?model=test');
assert.deepEqual(id,{conversationId:'abc-123',conversationUrl:'https://chatgpt.com/c/abc-123'});
assert.throws(()=>conversationIdentity('https://example.com/c/abc'),/CHATGPT_SNAPSHOT_URL_INVALID/);

const snapshot=normalizeChatgptSnapshot({
  conversationId:'abc-123',conversationUrl:'https://chatgpt.com/c/abc-123',title:' Real GPT ',tabId:42,
  messages:[{messageId:'u1',role:'user',text:'hello'},{messageId:'a1',role:'assistant',text:'world'}]
},()=> '2026-09-14T02:00:00.000Z');
assert.equal(snapshot.provider,'chatgpt-web');
assert.equal(snapshot.title,'Real GPT');
assert.equal(snapshot.messages.length,2);
assert.equal(snapshot.capturedAt,'2026-09-14T02:00:00.000Z');
assert.throws(()=>normalizeChatgptSnapshot({...snapshot,conversationId:'wrong'}),/CHATGPT_SNAPSHOT_CONVERSATION_MISMATCH/);
assert.throws(()=>normalizeChatgptSnapshot({conversationId:'abc-123',conversationUrl:'https://chatgpt.com/c/abc-123',messages:[{role:'system',text:'x'}]}),/CHATGPT_SNAPSHOT_ROLE_INVALID/);

const store=createChatgptProjectionStore({now:()=> '2026-09-14T02:00:00.000Z'});
store.upsert(snapshot);
assert.equal(store.get('abc-123')?.messages[1]?.text,'world');
store.upsert({...snapshot,title:'Updated',messages:[{role:'assistant',text:'latest'}],capturedAt:'2026-09-14T03:00:00.000Z'});
assert.equal(store.list()[0]?.title,'Updated');
assert.equal(store.list()[0]?.messages.length,1);
store.upsert({...snapshot,title:'Transient Empty',messages:[],capturedAt:'2026-09-14T04:00:00.000Z'});
assert.equal(store.get('abc-123')?.title,'Updated');
assert.equal(store.get('abc-123')?.messages.length,1);
console.log('chatgpt-projection.test.mjs PASS');
