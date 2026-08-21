export type TerminalChunk={runId:string;ptySessionId:string;pid:number|null;sequence:number;data:string;timestamp:string};
export type TerminalClose={runId:string;ptySessionId:string;pid:number|null;sequence:number;terminalClosedAt:string;exitCode:number|null;processSignal?:string|null};
export type TerminalEventSource=new(url:string)=>EventSource;

export class CodexTerminalClient {
  private source:EventSource|null=null;
  private runId:string|null=null;
  private cursor=0;
  private readonly EventSourceFactory:TerminalEventSource;
  private readonly basePath:string;
  constructor(EventSourceFactory:TerminalEventSource=EventSource,basePath='/api/codex/runtime'){this.EventSourceFactory=EventSourceFactory;this.basePath=basePath}
  connect(runId:string,handlers:{onChunk?:(chunk:TerminalChunk)=>void;onClose?:(close:TerminalClose)=>void;onError?:()=>void}={}){
    if(this.runId!==runId)this.cursor=0;
    this.disconnect();this.runId=runId;
    const source=this.source=new this.EventSourceFactory(`${this.basePath}/${encodeURIComponent(runId)}/terminal/stream?afterSequence=${this.cursor}`);
    source.addEventListener('chunk',(message:MessageEvent)=>{const chunk=JSON.parse(message.data) as TerminalChunk;if(chunk.runId!==this.runId||!Number.isSafeInteger(chunk.sequence)||chunk.sequence<=this.cursor)return;this.cursor=chunk.sequence;handlers.onChunk?.(chunk)});
    source.addEventListener('close',(message:MessageEvent)=>{const close=JSON.parse(message.data) as TerminalClose;if(close.runId!==this.runId)return;this.cursor=Math.max(this.cursor,close.sequence);handlers.onClose?.(close);this.disconnect()});
    source.onerror=()=>handlers.onError?.();
  }
  disconnect(){this.source?.close();this.source=null}
  get lastSequence(){return this.cursor}
}
