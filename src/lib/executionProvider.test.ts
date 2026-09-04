import assert from 'node:assert/strict';
import {createCodexExecutionProvider} from './codexExecutionProvider.ts';
import {normalizeProviderError,type ExecutionProvider,type ExecutionProviderContext} from './executionProvider.ts';

const context:ExecutionProviderContext={execution_id:'provider-exec-1',instruction_id:'instruction-1',repository:'/repo',branch:'delivery/test',worktree_path:'/repo-worktree',sandbox:'workspace-write',execution_type:'IMPLEMENTATION',spec_file:'/tmp/spec.json',supervisor_script:'/repo/scripts/aicc-run-supervisor.ts'};
const provider:ExecutionProvider={providerId:'mock',capabilities:{streaming:false,cancellation:true,structuredResults:true},validateExecution:c=>c.execution_id?null:{code:'INVALID_CONTEXT',message:'missing id'},startExecution:c=>({execution_id:c.execution_id,provider_id:'mock',status:'STARTING',process_id:1}),getExecutionStatus:()=> 'RUNNING',cancelExecution:()=>null,collectResult:c=>({execution_id:c.execution_id,provider_id:'mock',status:'COMPLETED',stdout:'ok',stderr:'',result_payload:{ok:true},completed_at:'now'})};
assert.equal(provider.validateExecution(context),null);assert.equal(provider.startExecution(context).status,'STARTING');const result=provider.collectResult(context);assert.equal(result.provider_id,'mock');assert.deepEqual(result.result_payload,{ok:true});assert.equal(normalizeProviderError({code:'TIMEOUT',message:'timed out'}).code,'TIMEOUT');assert.equal(normalizeProviderError(new Error('boom')).code,'EXECUTION_FAILED');
const unavailable=createCodexExecutionProvider({available:false});assert.equal(unavailable.validateExecution(context)?.code,'PROVIDER_UNAVAILABLE');assert.equal(unavailable.startExecution(context).error?.code,'PROVIDER_UNAVAILABLE');
console.log('execution provider contract matrix passed');
