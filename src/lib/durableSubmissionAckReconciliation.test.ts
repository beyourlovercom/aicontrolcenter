import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';

const root=process.cwd();
const workerSource=readFileSync(join(root,'web-adapter/chrome-extension-current/service-worker.js'),'utf8');
const inboxItem={id:'inbox-canonical',submissionId:'submission-original',payloadHash:'payload-hash',taskId:'task-canonical',executionId:'run-canonical',runId:'run-canonical',state:'LAUNCHED',runtimeState:'RUNNING',instruction:{instructionId:'instruction-canonical',sourceType:'GPT_BLOCK',originContext:{conversationId:'conversation-canonical'}}};
const outboxItem={id:'outbox-canonical',inboxId:'inbox-canonical',executionId:'run-canonical',runId:'run-canonical',state:'READY',report:{status:'COMPLETED',canonicalResult:{version:'AICC_EXECUTION_RESULT_V1',executionId:'run-canonical',resultId:'result-canonical',resultHash:'result-hash',rawResult:'PASS'}}};
const pending={submission_id:'submission-original',instruction_id:'instruction-canonical',payload_hash:'payload-hash',source:'GPT_BLOCK',conversation_id:'conversation-canonical',source_reference:'https://chatgpt.com/c/conversation-canonical',origin_context:{conversationId:'conversation-canonical'},created_at:'2026-08-16T09:45:09.000Z',ack_state:'UNCONFIRMED'};
const storage:Record<string,unknown>={'aicc-gpt-bridge-pending-submission-v1':pending};
let listener:any;
let inboxPosts=0;
const context={
  console,
  URL,
  Date,
  encodeURIComponent,
  fetch:async (url:string,init?:{method?:string})=>{
    if(url.endsWith('/api/gpt-bridge/inbox')&&init?.method==='POST') inboxPosts+=1;
    const body=url.endsWith('/api/gpt-bridge/inbox')?{items:[inboxItem]}:url.endsWith('/api/gpt-bridge/outbox')?{items:[outboxItem]}:{};
    return {ok:true,status:200,json:async()=>body};
  },
  chrome:{
    storage:{local:{
      get:async (keys:string|string[])=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(key=>[key,storage[key]])),
      set:async (value:Record<string,unknown>)=>Object.assign(storage,value)
    }},
    runtime:{onMessage:{addListener:(value:any)=>{listener=value;}}}
  }
};
vm.runInNewContext(workerSource,context);
assert.equal(typeof listener,'function');
const response=await new Promise<any>(resolve=>listener({type:'RECONCILE_SUBMISSION',pending},{tab:{id:1}},resolve));
assert.equal(response.ok,true);
assert.equal(response.reconciled,true);
assert.equal(response.inbox.id,'inbox-canonical');
assert.equal(response.item.id,'outbox-canonical','terminal canonical Outbox truth wins after delayed acknowledgement');
assert.equal(response.correlation.inboxId,'inbox-canonical');
assert.equal(response.correlation.runId,'run-canonical');
assert.equal((storage['aicc-gpt-bridge-pending-submission-v1'] as any).ack_state,'ACKNOWLEDGED');
assert.equal(inboxPosts,0,'reconciliation is read-only and never automatically resubmits');

const fallback={...pending,submission_id:'submission-retry'};
const fallbackResponse=await new Promise<any>(resolve=>listener({type:'RECONCILE_SUBMISSION',pending:fallback},{tab:{id:1}},resolve));
assert.equal(fallbackResponse.reconciled,false,'a new submission identity cannot bind to an older execution');
assert.equal(inboxPosts,0);

const changed={...fallback,payload_hash:'changed-payload'};
const changedResponse=await new Promise<any>(resolve=>listener({type:'RECONCILE_SUBMISSION',pending:changed},{tab:{id:1}},resolve));
assert.equal(changedResponse.reconciled,false,'changed payload cannot bind to the old execution');
assert.equal(inboxPosts,0);
console.log('M8.2.1.8.10A durable acknowledgement reconciliation matrix passed');
