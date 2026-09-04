export const REMOTE_RUNTIME_PROTOCOL_VERSION='AICC_REMOTE_RUNTIME_V1' as const;
export type ExecutionProviderId='LOCAL_CODEX'|'REMOTE_CLAUDE';
export type RemoteProvider='CLAUDE_CODE';
export type RemoteExecutionEnvelope=Readonly<{protocolVersion:typeof REMOTE_RUNTIME_PROTOCOL_VERSION;executionId:string;runnerId:string;provider:RemoteProvider;repositoryRoot:string;instruction:string;createdAt:string}>;
export type RemoteEventType='QUEUED'|'CLAIMED'|'SPAWNED'|'RUNNING'|'OUTPUT'|'STDERR'|'EXITED'|'RESULT_SAVED';
export type RemoteExecutionEvent=Readonly<{executionId:string;runnerId:string;sequenceId:number;eventType:RemoteEventType;timestamp:string;payload:unknown}>;

export function createRemoteExecutionEnvelope(input:Omit<RemoteExecutionEnvelope,'protocolVersion'>):RemoteExecutionEnvelope{return {protocolVersion:REMOTE_RUNTIME_PROTOCOL_VERSION,...input}}

export class RemoteEventStore{
  private readonly events=new Map<string,RemoteExecutionEvent[]>();
  append(input:Omit<RemoteExecutionEvent,'sequenceId'>):RemoteExecutionEvent{const current=this.events.get(input.executionId)??[],event={...input,sequenceId:current.length+1};this.events.set(input.executionId,[...current,event]);return event}
  after(executionId:string,lastAckSequenceId=0):RemoteExecutionEvent[]{return (this.events.get(executionId)??[]).filter(event=>event.sequenceId>lastAckSequenceId)}
  all(executionId:string):RemoteExecutionEvent[]{return [...(this.events.get(executionId)??[])]}
}

export type ClaimState={executionId:string;runnerId:string;state:'CLAIMED'|'RUNNING'|'COMPLETED'|'FAILED';result?:unknown};
export class ExactlyOnceExecutionClaims{
  private readonly claims=new Map<string,ClaimState>();
  claim(executionId:string,runnerId:string):{accepted:boolean;state:ClaimState}{const existing=this.claims.get(executionId);if(existing)return {accepted:false,state:existing};const state:ClaimState={executionId,runnerId,state:'CLAIMED'};this.claims.set(executionId,state);return {accepted:true,state}}
  update(executionId:string,state:ClaimState['state'],result?:unknown):ClaimState{const current=this.claims.get(executionId);if(!current)throw new Error('EXECUTION_NOT_CLAIMED');const next={...current,state,result};this.claims.set(executionId,next);return next}
  get(executionId:string):ClaimState|undefined{return this.claims.get(executionId)}
}
