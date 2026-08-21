import {mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {executeClaude,type ClaudeProcessAdapter, type ClaudeProcess} from './claudeExecutionAdapter.ts';
import {createRemoteExecutionEnvelope,ExactlyOnceExecutionClaims,type RemoteExecutionEnvelope,type RemoteExecutionEvent} from './remoteRuntimeProtocol.ts';
type DirectExecution={envelope:RemoteExecutionEnvelope;state:'QUEUED'|'RUNNING'|'COMPLETED'|'FAILED';events:RemoteExecutionEvent[];ack:number;facts?:ClaudeProcess};
export class DirectRunnerService{
  private state:Record<string,DirectExecution>={};
  private readonly claims=new ExactlyOnceExecutionClaims();
  private readonly runnerId:string;private readonly workspace:string;private readonly claudeBin:string;private readonly file?:string;private readonly adapter?:ClaudeProcessAdapter;
  constructor(runnerId:string,workspace:string,claudeBin:string,file?:string,adapter?:ClaudeProcessAdapter){this.runnerId=runnerId;this.workspace=workspace;this.claudeBin=claudeBin;this.file=file;this.adapter=adapter;if(file)try{this.state=JSON.parse(readFileSync(file,'utf8'));for(const item of Object.values(this.state))if(item.state==='RUNNING')this.claims.claim(item.envelope.executionId,runnerId)}catch{} }
  private persist(){if(!this.file)return;mkdirSync(dirname(this.file),{recursive:true});const tmp=`${this.file}.${process.pid}.tmp`;writeFileSync(tmp,JSON.stringify(this.state));renameSync(tmp,this.file)}
  private event(item:DirectExecution,eventType:RemoteExecutionEvent['eventType'],payload:unknown){const event={executionId:item.envelope.executionId,runnerId:this.runnerId,sequenceId:item.events.length+1,eventType,timestamp:new Date().toISOString(),payload};item.events.push(event);this.persist();return event}
  health(){return {ok:true,runnerId:this.runnerId,provider:'REMOTE_CLAUDE',version:'phase-2-direct'}}
  status(){return {runnerId:this.runnerId,provider:'REMOTE_CLAUDE',activeExecutionIds:Object.values(this.state).filter(x=>x.state==='RUNNING').map(x=>x.envelope.executionId)}}
  get(id:string){return this.state[id]??null}
  events(id:string,after=0){return (this.state[id]?.events??[]).filter(e=>e.sequenceId>after)}
  ack(id:string,sequence:number){const item=this.state[id];if(!item)throw new Error('EXECUTION_NOT_FOUND');item.ack=Math.max(item.ack,sequence);this.persist();return item.ack}
  async submit(input:Omit<RemoteExecutionEnvelope,'protocolVersion'>){const envelope=createRemoteExecutionEnvelope(input),existing=this.state[envelope.executionId];if(existing)return existing;const item:DirectExecution={envelope,state:'QUEUED',events:[],ack:0};this.state[envelope.executionId]=item;this.event(item,'QUEUED',{});this.persist();const claim=this.claims.claim(envelope.executionId,this.runnerId);if(!claim.accepted)return item;item.state='RUNNING';this.event(item,'CLAIMED',{});this.event(item,'SPAWNED',{});void this.run(item);return item}
  private async run(item:DirectExecution){try{this.event(item,'RUNNING',{});const facts=await executeClaude(item.envelope.instruction,this.workspace,this.adapter,this.claudeBin);item.facts=facts;item.state=facts.exitCode===0?'COMPLETED':'FAILED';this.event(item,'OUTPUT',facts.stdout);if(facts.stderr)this.event(item,'STDERR',facts.stderr);this.event(item,'EXITED',{pid:facts.pid,exitCode:facts.exitCode,startedAt:facts.startedAt,completedAt:facts.completedAt});this.event(item,'RESULT_SAVED',facts);this.claims.update(item.envelope.executionId,item.state==='COMPLETED'?'COMPLETED':'FAILED',facts);this.persist()}catch(error){item.state='FAILED';this.event(item,'RESULT_SAVED',{error:error instanceof Error?error.message:'CLAUDE_EXECUTION_ERROR'});this.persist()}}
}
