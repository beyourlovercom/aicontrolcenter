import assert from 'node:assert/strict';
import { createServer, get, type IncomingMessage } from 'node:http';
import { mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CodexTerminalClient } from './codexTerminalClient.ts';
import { createRuntimeTerminalStreamHandler, terminalStreamEvents } from './runtimeTerminalStream.ts';
import type { RuntimeState } from './runtimeManager.ts';

const runtime=(overrides:Partial<RuntimeState>={}):RuntimeState=>({runId:'run-a',projectId:'aicc',repositoryIdentity:'aicc-repo',workPackageId:null,authorizationId:'authorization',authoritySha:'sha',branch:'branch',startingHeadSha:'head',pid:42,ptySessionId:'pty-run-a',terminalSequence:3,terminalFirstSequence:1,terminalChunks:['one','two','three'],terminalUpdatedAt:'2026-08-18T00:00:00.000Z',threadId:null,phase:'RUNNING',currentTask:'running',latestEvent:'runtime',startedAt:'2026-08-18T00:00:00.000Z',lastActivityAt:'2026-08-18T00:00:00.000Z',events:[],...overrides});

const all=terminalStreamEvents(runtime());
assert.deepEqual(all.filter(event=>event.event==='chunk').map(event=>event.event==='chunk'?event.id:0),[1,2,3]);
assert.deepEqual(terminalStreamEvents(runtime(),2).map(event=>event.event==='chunk'?event.id:event.data.sequence),[3]);
assert.equal(terminalStreamEvents(runtime({runId:'run-b',terminalFirstSequence:8,terminalSequence:10}),8).filter(event=>event.event==='chunk')[0]?.data.runId,'run-b');
const completed=terminalStreamEvents(runtime({terminalClosedAt:'2026-08-18T00:01:00.000Z',exitCode:0}));
assert.equal(completed.at(-1)?.event,'close');
assert.equal((completed.at(-1) as {event:'close';data:{sequence:number}}).data.sequence,3);

class FakeEventSource {
  static instances:FakeEventSource[]=[];
  readonly listeners=new Map<string,((event:MessageEvent)=>void)[]>();
  onerror:(()=>void)|null=null;
  closed=false;
  readonly url:string;
  constructor(url:string){this.url=url;FakeEventSource.instances.push(this)}
  addEventListener(type:string,listener:(event:MessageEvent)=>void){this.listeners.set(type,[...(this.listeners.get(type)??[]),listener])}
  close(){this.closed=true}
  emit(type:string,data:unknown){for(const listener of this.listeners.get(type)??[])listener({data:JSON.stringify(data)} as MessageEvent)}
}

const received:number[]=[];
const client=new CodexTerminalClient(FakeEventSource as unknown as new(url:string)=>EventSource);
client.connect('run-a',{onChunk:chunk=>received.push(chunk.sequence)});
const first=FakeEventSource.instances[0];
first.emit('chunk',{runId:'run-a',ptySessionId:'pty-run-a',pid:42,sequence:1,data:'one',timestamp:'now'});
first.emit('chunk',{runId:'run-a',ptySessionId:'pty-run-a',pid:42,sequence:1,data:'duplicate',timestamp:'now'});
first.emit('chunk',{runId:'run-b',ptySessionId:'pty-run-b',pid:43,sequence:2,data:'wrong-run',timestamp:'now'});
assert.deepEqual(received,[1]);
client.connect('run-a',{onChunk:chunk=>received.push(chunk.sequence)});
assert.equal(first.closed,true);
assert.match(FakeEventSource.instances[1].url,/afterSequence=1/);
client.disconnect();
assert.equal(FakeEventSource.instances[1].closed,true);

const fixtureDir=mkdtempSync(join(tmpdir(),'aicc-terminal-stream-'));
let fixture=runtime({terminalSequence:1,terminalFirstSequence:1,terminalChunks:['first']});
const fixtureFile=join(fixtureDir,'runtime-run-run-a.json');
const writeFixture=()=>{const temporary=`${fixtureFile}.tmp`;writeFileSync(temporary,JSON.stringify(fixture));renameSync(temporary,fixtureFile)};
writeFixture();
const handler=createRuntimeTerminalStreamHandler({stateDir:fixtureDir,readRuntime:async runId=>runId==='run-a'?fixture:null});
const server=createServer((request,response)=>handler(request,response));
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=(server.address() as {port:number}).port;
const events:string[]=[];
const stream=await new Promise<IncomingMessage>((resolve,reject)=>{
const request=get(`http://127.0.0.1:${port}/run-a/terminal/stream`,response=>resolve(response));
  request.once('error',reject);
});
stream.setEncoding('utf8');
stream.on('data',chunk=>events.push(chunk));
await new Promise(resolve=>setTimeout(resolve,25));
fixture=runtime({terminalSequence:2,terminalFirstSequence:1,terminalChunks:['first','second'],terminalClosedAt:'2026-08-18T00:01:00.000Z',exitCode:0});
writeFixture();
await new Promise<void>(resolve=>stream.once('end',resolve));
assert.match(events.join(''),/"sequence":1/);
assert.match(events.join(''),/"sequence":2/);
assert.match(events.join(''),/event: close/);
await new Promise<void>(resolve=>server.close(()=>resolve()));
rmSync(fixtureDir,{recursive:true,force:true});
console.log('runtime terminal stream contract passed');
