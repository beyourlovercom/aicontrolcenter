import type {FormalWorkPackage, RuntimeRecord, WriterLockState} from './model/entityTypes.ts';

export type NormalizedRuntimeEvent={kind:'thread'|'turn'|'item'|'message'|'error'|'unknown';label:string;timestamp:string;technicalType:string;detail?:string};
export type AcceptanceEvidence={label:string;state:'PASS'|'PENDING'|'UNAVAILABLE';evidence:string};
export type RuntimeObserverModel={status:'ABSENT'|'ACTIVE'|'COMPLETED'|'FAILED'|'STOPPED';summary:string;activity:string;events:NormalizedRuntimeEvent[];elapsedMs:number|null;process:'ALIVE'|'DEAD'|'UNKNOWN';metrics:{agentMessages:number|null;commands:number|null;fileChanges:number|null;toolCalls:number|null;errors:number|null};health:'HEALTHY'|'SILENT'|'STARTUP_TIMEOUT'|'FAILED'|'UNAVAILABLE';writerLock:WriterLockState;acceptance:{progress:number|null;items:AcceptanceEvidence[]};terminal:string|null};
export function runtimeStatusLabel(status:RuntimeObserverModel['status']){return ({ABSENT:'不存在',ACTIVE:'运行中',COMPLETED:'已完成',FAILED:'失败',STOPPED:'已停止'})[status]}
export function runtimeHealthLabel(health:RuntimeObserverModel['health']){return ({HEALTHY:'健康',SILENT:'安静',STARTUP_TIMEOUT:'启动超时',FAILED:'失败',UNAVAILABLE:'不可用'})[health]}
export function writerLockLabel(status:WriterLockState['status']){return ({HELD:'已持有',NOT_HELD:'未持有',UNAVAILABLE:'不可用'})[status]}

const MAX_EVENTS=12;
function eventType(value:string){if(value.startsWith('thread.'))return 'thread';if(value.startsWith('turn.'))return 'turn';if(value.startsWith('item.'))return 'item';if(value.includes('message'))return 'message';if(value==='error')return 'error';return 'unknown'}
export function resolveCurrentActivity(runtime:RuntimeRecord|null):string{
  if(!runtime)return '不可用';
  const value=runtime.events?.at(-1)??runtime.latestEvent??'';
  if(value.includes('command_execution'))return runtime.currentTask&&runtime.currentTask!=='正在执行命令'?'执行：'+runtime.currentTask:'执行命令';
  if(value.includes('file_change'))return runtime.currentTask&&runtime.currentTask!=='正在执行'?'修改：'+runtime.currentTask:'修改文件';
  if(value.includes('file_read')||value.includes('read'))return runtime.currentTask&&runtime.currentTask!=='正在执行'?'读取：'+runtime.currentTask:'读取文件';
  if(value.includes('agent_message')||value.includes('message'))return 'Codex 正在分析';
  if(value==='thread.started'||value==='turn.started')return 'Codex 正在分析';
  if(value==='error')return '运行错误';
  if(runtime.currentTask&&runtime.currentTask!=='准备启动 Codex'&&runtime.currentTask!=='最近项目已完成')return runtime.currentTask;
  return value?'安全技术事件：'+value:'不可用';
}
export function normalizeRuntimeEvent(value:string,timestamp=new Date().toISOString()):NormalizedRuntimeEvent{const kind=eventType(value);const label=value.includes('command_execution')?'执行':value.includes('file_change')?'修改':value.includes('file_read')||value.includes('read')?'读取':value.includes('agent_message')||value.includes('message')?'Codex 消息':value==='error'?'错误':value==='thread.started'||value==='turn.started'?'Codex 启动':'安全技术事件';return {kind,label,timestamp,technicalType:value};}
export function normalizeRuntimeEvents(runtime:RuntimeRecord):NormalizedRuntimeEvent[]{return (runtime.events??[]).slice(-MAX_EVENTS).map((event)=>normalizeRuntimeEvent(event,runtime.lastActivityAt));}
export function resolveRuntimeMetric(value:number|undefined){return typeof value==='number'?value:null}
function acceptance(wp:FormalWorkPackage|null,runtime:RuntimeRecord|null){
  if(!wp)return {progress:null,items:[]};
  const raw=wp.sections['Acceptance Criteria']??'';const lines=raw.split(/\n|(?<=\.)\s+(?=-\s)/).map(v=>v.replace(/^\s*[-*]\s*/,'').trim()).filter(Boolean);
  if(!lines.length)return {progress:null,items:[]};
  const active=runtime?['STARTING','RUNNING','STOPPING'].includes(runtime.phase):false;
  const done=runtime?.phase==='COMPLETED'&&runtime.codeChangePresent===true;
  const items=lines.map(label=>({label,state:done?'PASS':active?'PENDING':'UNAVAILABLE',evidence:done?'runtime completed with code-change evidence':active?'等待可观测 Runtime 证据':'当前没有可验证的实施验收证据'} as AcceptanceEvidence));
  return {progress:done?100:active?null:null,items};
}
export function buildRuntimeObserver(runtime:RuntimeRecord|null,wp:FormalWorkPackage|null,lock:WriterLockState,now=Date.now()):RuntimeObserverModel{
  if(!runtime)return {status:'ABSENT',summary:'暂无运行记录',elapsedMs:null,activity:'不可用',events:[],process:'UNKNOWN',metrics:{agentMessages:null,commands:null,fileChanges:null,toolCalls:null,errors:null},health:'UNAVAILABLE',writerLock:lock,acceptance:acceptance(wp,null),terminal:null};
  const active=['STARTING','RUNNING','STOPPING'].includes(runtime.phase);const status=active?'ACTIVE':runtime.phase==='COMPLETED'?'COMPLETED':runtime.phase==='STOPPED'?'STOPPED':'FAILED';
  const end=runtime.completedAt?Date.parse(runtime.completedAt):now;const elapsed=Date.parse(runtime.startedAt);const age=Date.parse(runtime.lastActivityAt);const health=runtime.phase==='STARTING'&&now-elapsed>15000?'STARTUP_TIMEOUT':status==='FAILED'?'FAILED':active&&now-age>30000?'SILENT':'HEALTHY';
  return {status,summary:status==='ACTIVE'?'Codex 正在运行':status==='COMPLETED'?'Codex 已完成':status==='FAILED'?'Codex 运行失败':status==='STOPPED'?'Codex 已停止':'Codex Runtime',elapsedMs:Number.isFinite(elapsed)?Math.max(0,end-elapsed):null,activity:resolveCurrentActivity(runtime),events:normalizeRuntimeEvents(runtime),process:runtime.pidAlive===true&&active?'ALIVE':runtime.pidAlive===false||!active?'DEAD':'UNKNOWN',metrics:{agentMessages:resolveRuntimeMetric(runtime.agentMessageCount),commands:resolveRuntimeMetric(runtime.commandExecutionCount),fileChanges:resolveRuntimeMetric(runtime.fileChangeEventCount),toolCalls:resolveRuntimeMetric(runtime.toolCallCount),errors:resolveRuntimeMetric(runtime.errorEventCount)},health,writerLock:lock,acceptance:acceptance(wp,runtime),terminal:runtime.failure??runtime.implementationResult??null};
}
