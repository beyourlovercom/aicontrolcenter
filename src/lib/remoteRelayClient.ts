import type {RemoteExecutionEnvelope,RemoteExecutionEvent} from './remoteRuntimeProtocol.ts';
export class RemoteRelayClient{
  constructor(private readonly baseUrl:string,private readonly token:string,private readonly fetcher=fetch){}
  private async call(path:string,init:RequestInit={}){const response=await this.fetcher(`${this.baseUrl}${path}`,{...init,headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/json',...(init.headers??{})}});if(!response.ok)throw new Error(`REMOTE_RELAY_${response.status}`);return response.json()}
  enqueue(envelope:RemoteExecutionEnvelope){return this.call('/v1/executions',{method:'POST',body:JSON.stringify(envelope)})}
  next(runnerId:string){return this.call(`/v1/runners/${encodeURIComponent(runnerId)}/executions/next`)}
  events(id:string,after=0){return this.call(`/v1/executions/${encodeURIComponent(id)}/events?after=${after}`)}
  eventsPost(id:string,event:RemoteExecutionEvent){return this.call(`/v1/executions/${encodeURIComponent(id)}/events`,{method:'POST',body:JSON.stringify(event)})}
  ack(id:string,sequence:number){return this.call(`/v1/executions/${encodeURIComponent(id)}/ack`,{method:'POST',body:JSON.stringify({sequenceId:sequence})})}
  heartbeat(runnerId:string,body:unknown){return this.call(`/v1/runners/${encodeURIComponent(runnerId)}/heartbeat`,{method:'POST',body:JSON.stringify(body)})}
}
