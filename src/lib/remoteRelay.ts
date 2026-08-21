import {mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import type {RemoteExecutionEnvelope,RemoteExecutionEvent} from './remoteRuntimeProtocol.ts';
type RecordState={envelope:RemoteExecutionEnvelope;owner?:string;events:RemoteExecutionEvent[];ack:number;terminal?:unknown};
export class RemoteRelayStore{
  private state:Record<string,RecordState>={};
  private readonly file?:string;
  constructor(file?:string){this.file=file;if(file)try{this.state=JSON.parse(readFileSync(file,'utf8'))}catch{} }
  private persist(){if(!this.file)return;mkdirSync(dirname(this.file),{recursive:true});const tmp=`${this.file}.${process.pid}.tmp`;writeFileSync(tmp,JSON.stringify(this.state));renameSync(tmp,this.file)}
  enqueue(envelope:RemoteExecutionEnvelope){if(!this.state[envelope.executionId])this.state[envelope.executionId]={envelope,events:[],ack:0};this.persist();return this.state[envelope.executionId]}
  next(runnerId:string){return Object.values(this.state).find(x=>x.envelope.runnerId===runnerId&&!x.owner&&!x.terminal)?.envelope??null}
  claim(id:string,runnerId:string){const x=this.state[id];if(!x)throw new Error('EXECUTION_NOT_FOUND');if(x.owner&&x.owner!==runnerId)throw new Error('EXECUTION_CLAIMED');x.owner=runnerId;this.persist();return x}
  addEvent(id:string,event:RemoteExecutionEvent){const x=this.state[id];if(!x)throw new Error('EXECUTION_NOT_FOUND');if(event.sequenceId!==x.events.length+1)throw new Error('SEQUENCE_INVALID');x.events.push(event);if(event.eventType==='RESULT_SAVED')x.terminal=event.payload;this.persist();return event}
  eventsAfter(id:string,after=0){return (this.state[id]?.events??[]).filter(e=>e.sequenceId>after)}
  ack(id:string,sequence:number){const x=this.state[id];if(!x)throw new Error('EXECUTION_NOT_FOUND');x.ack=Math.max(x.ack,sequence);this.persist();return x.ack}
  get(id:string){return this.state[id]??null}
}
