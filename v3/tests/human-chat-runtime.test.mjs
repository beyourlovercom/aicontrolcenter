import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {claimHumanChat,createHumanChatRequest,readHumanChatRequest,recordHumanChatReceipt} from '../lib/human-chat-runtime.mjs';

test('human chat queue delivers one exact message without work/task semantics',()=>{
  const env={AICC_V3_HOME:mkdtempSync(join(tmpdir(),'aicc-human-chat-'))};
  const created=createHumanChatRequest({roomId:'room-1',conversationId:'conv-1',conversationUrl:'https://chatgpt.com/c/conv-1',content:'你好，继续聊一下'},env,{uuid:()=> '10000000-0000-4000-8000-000000000001',now:()=> '2026-09-18T08:00:00.000Z'});
  assert.equal(created.state.state,'PENDING');assert.equal(created.request.content,'你好，继续聊一下');
  const claimed=claimHumanChat({bridgeInstanceId:'bridge-1'},env,{uuid:()=> '20000000-0000-4000-8000-000000000001',now:()=> '2026-09-18T08:00:01.000Z'});
  assert.equal(claimed.request.requestId,created.request.requestId);assert.equal(claimed.state.state,'CLAIMED');
  const done=recordHumanChatReceipt(created.request.requestId,{claimId:claimed.state.claim.claimId,outcome:'DELIVERED'},env,{now:()=> '2026-09-18T08:00:02.000Z'});
  assert.equal(done.state.state,'DELIVERED');assert.equal(readHumanChatRequest(created.request.requestId,env).state.state,'DELIVERED');
  assert.equal(claimHumanChat({bridgeInstanceId:'bridge-1'},env),null);
});
