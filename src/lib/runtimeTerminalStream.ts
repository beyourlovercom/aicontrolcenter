import { watch, type FSWatcher } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolveAiccStateDir } from './stateDirectory.ts';
import { readRuntimeByRunIdReadOnly, type RuntimeState } from './runtimeManager.ts';

export type RuntimeTerminalChunkEvent={runId:string;ptySessionId:string;pid:number|null;sequence:number;data:string;timestamp:string};
export type RuntimeTerminalCloseEvent={runId:string;ptySessionId:string;pid:number|null;sequence:number;terminalClosedAt:string;exitCode:number|null;processSignal?:string|null};
export type RuntimeTerminalStreamEvent={event:'chunk';id:number;data:RuntimeTerminalChunkEvent}|{event:'close';data:RuntimeTerminalCloseEvent};

export function terminalStreamEvents(runtime:RuntimeState,afterSequence=0):RuntimeTerminalStreamEvent[]{
  const chunks=runtime.terminalChunks??[];
  const lastSequence=runtime.terminalSequence??0;
  const firstSequence=runtime.terminalFirstSequence??Math.max(1,lastSequence-chunks.length+1);
  const ptySessionId=runtime.ptySessionId??`pty-${runtime.runId}`;
  const timestamp=runtime.terminalUpdatedAt??runtime.terminalStartedAt??runtime.lastActivityAt??runtime.startedAt;
  const events:RuntimeTerminalStreamEvent[]=chunks.map((data,index):RuntimeTerminalStreamEvent=>({event:'chunk',id:firstSequence+index,data:{runId:runtime.runId,ptySessionId,pid:runtime.pid,sequence:firstSequence+index,data,timestamp}})).filter(event=>event.event==='chunk'&&event.id>afterSequence);
  if(runtime.terminalClosedAt&&lastSequence>=afterSequence)events.push({event:'close',data:{runId:runtime.runId,ptySessionId,pid:runtime.pid,sequence:lastSequence,terminalClosedAt:runtime.terminalClosedAt,exitCode:runtime.exitCode??null,processSignal:runtime.processSignal}});
  return events;
}

type StreamDependencies={stateDir?:string;readRuntime?:(runId:string)=>Promise<RuntimeState|null>};
function streamPath(url:string):{runId:string}|null{const pathname=new URL(url,'http://localhost').pathname;const match=pathname.match(/(?:^|\/api\/codex\/runtime\/|^\/)([^/]+)\/terminal\/stream\/?$/);return match?{runId:decodeURIComponent(match[1])}:null}
function cursor(req:IncomingMessage,url:URL):number{const supplied=url.searchParams.get('afterSequence');const lastEventId=req.headers['last-event-id'];const value=Number(supplied??lastEventId??0);return Number.isSafeInteger(value)&&value>=0?value:0}
function writeEvent(res:ServerResponse,event:RuntimeTerminalStreamEvent){if(event.event==='chunk')res.write(`id: ${event.id}\nevent: chunk\ndata: ${JSON.stringify(event.data)}\n\n`);else res.write(`event: close\ndata: ${JSON.stringify(event.data)}\n\n`)}

export function createRuntimeTerminalStreamHandler(dependencies:StreamDependencies={}){
  const stateDir=dependencies.stateDir??resolveAiccStateDir();
  const readRuntime=dependencies.readRuntime??readRuntimeByRunIdReadOnly;
  return (req:IncomingMessage,res:ServerResponse,next?:()=>void)=>{
    const path=streamPath(req.url??'/');
    if(!path){next?.();return}
    if(req.method!=='GET'){res.statusCode=405;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'METHOD_NOT_ALLOWED'}));return}
    const url=new URL(req.url??'/','http://localhost');
    void readRuntime(path.runId).then(initial=>{
      if(!initial){res.statusCode=404;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'RUN_NOT_FOUND',runId:path.runId}));return}
      let afterSequence=cursor(req,url),closed=false,watcher:FSWatcher|undefined,tailTimer:ReturnType<typeof setInterval>|undefined,flushQueued=Promise.resolve();
      const finish=()=>{if(closed)return;closed=true;watcher?.close();if(tailTimer)clearInterval(tailTimer);if(!res.writableEnded)res.end()};
      const flush=()=>{flushQueued=flushQueued.then(async()=>{if(closed)return;const runtime=await readRuntime(path.runId);if(!runtime)return;for(const event of terminalStreamEvents(runtime,afterSequence)){writeEvent(res,event);if(event.event==='chunk')afterSequence=event.id;else {finish();return}}}).catch(()=>finish());return flushQueued};
      res.statusCode=200;res.setHeader('Content-Type','text/event-stream');res.setHeader('Cache-Control','no-cache, no-transform');res.setHeader('Connection','keep-alive');res.setHeader('X-Accel-Buffering','no');res.flushHeaders?.();
      try{watcher=watch(stateDir,(_kind,file)=>{const name=String(file??'');if(name===`runtime-${path.runId}.json`||name==='runtime.json'||name==='runtime-history.json')void flush()});}catch{finish();return}
      tailTimer=setInterval(()=>void flush(),250);tailTimer.unref?.();
      req.once('close',finish);
      void flush();
    }).catch(()=>{res.statusCode=503;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'RUNTIME_STREAM_UNAVAILABLE'}))})
  };
}
