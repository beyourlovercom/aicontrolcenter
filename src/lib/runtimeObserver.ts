import type {FormalWorkPackage, RuntimeRecord, WriterLockState} from './model/entityTypes.ts';

export type NormalizedRuntimeEvent={kind:'thread'|'turn'|'item'|'message'|'error'|'unknown';label:string;timestamp:string;technicalType:string;detail?:string};
export type AcceptanceEvidence={label:string;state:'PASS'|'PENDING'|'UNAVAILABLE';evidence:string};
export type RuntimeObserverModel={status:'ABSENT'|'ACTIVE'|'COMPLETED'|'FAILED'|'STOPPED';summary:string;activity:string;events:NormalizedRuntimeEvent[];elapsedMs:number|null;process:'ALIVE'|'DEAD'|'UNKNOWN';metrics:{agentMessages:number|null;commands:number|null;fileChanges:number|null;toolCalls:number|null;errors:number|null};health:'HEALTHY'|'SILENT'|'STARTUP_TIMEOUT'|'FAILED'|'UNAVAILABLE';writerLock:WriterLockState;acceptance:{progress:number|null;items:AcceptanceEvidence[]};terminal:string|null};
export function runtimeStatusLabel(status:RuntimeObserverModel['status']){return ({ABSENT:'不存在',ACTIVE:'运行中',COMPLETED:'已完成',FAILED:'失败',STOPPED:'已停止'})[status]}
export function runtimeHealthLabel(health:RuntimeObserverModel['health']){return ({HEALTHY:'健康',SILENT:'安静',STARTUP_TIMEOUT:'启动超时',FAILED:'失败',UNAVAILABLE:'不可用'})[health]}
export function writerLockLabel(status:WriterLockState['status']){return ({HELD:'已持有',NOT_HELD:'未持有',UNAVAILABLE:'不可用'})[status]}

const MAX_EVENTS=12;
function eventType(value:string){if(/^thread\.(started|completed)$/.test(value))return 'thread';if(/^turn\.(started|completed|failed)$/.test(value))return 'turn';if(/^item\.(started|completed|updated)(?::|$)/.test(value))return 'item';if(/^(agent_message|item\.(started|completed):agent_message)$/.test(value))return 'message';if(value==='error'||value.startsWith('error:'))return 'error';return 'unknown'}
export function resolveCurrentActivity(runtime:RuntimeRecord|null):string{
  if(!runtime)return '不可用';
  const events=Array.isArray(runtime.events)?runtime.events.filter((event):event is string=>typeof event==='string'):[];
  const value=events.at(-1)??(typeof runtime.latestEvent==='string'?runtime.latestEvent:'');
  const presentation=resolveEventPresentation(value);
  if(presentation.label!=='技术事件')return presentation.detail?`${presentation.label}：${presentation.detail}`:presentation.label;
  if(runtime.currentTask&&runtime.currentTask!=='准备启动 Codex'&&runtime.currentTask!=='最近项目已完成')return runtime.currentTask;
  return value?'技术事件：'+value:'不可用';
}
function resolveEventPresentation(value:string):{label:string;detail?:string}{
  const parts=value.split(':');
  const detail=parts.length>2?parts.slice(2).join(':'):undefined;
  if(value==='thread.started'||value==='turn.started')return {label:'启动',detail:'Codex'};
  if(value.includes('item.completed:file_change'))return {label:'修改'};
  if(value==='thread.completed'||value==='turn.completed'||value.startsWith('item.completed'))return {label:'完成',detail:'Codex'};
  if(value==='error'||value.startsWith('error:'))return {label:'失败'};
  if(/(?:^|:)command_execution(?:$|:)/.test(value))return {label:'执行',detail};
  if(/(?:^|:)file_change(?:$|:)/.test(value))return {label:'修改',detail};
  if(/(?:^|:)(?:file_read|read_file)(?:$|:)/.test(value))return {label:'读取',detail};
  if(/(?:^|:)(?:agent_message|message)(?:$|:)/.test(value))return {label:'消息'};
  return {label:'技术事件'};
}
export function normalizeRuntimeEvent(value:string,timestamp=new Date().toISOString()):NormalizedRuntimeEvent{const kind=eventType(value);const presentation=resolveEventPresentation(value);return {kind,label:presentation.label,timestamp,technicalType:value,detail:presentation.detail};}
export function normalizeRuntimeEvents(runtime:RuntimeRecord):NormalizedRuntimeEvent[]{const events=Array.isArray(runtime.events)?runtime.events.filter((event):event is string=>typeof event==='string'):[];return events.slice(-MAX_EVENTS).map((event)=>normalizeRuntimeEvent(event,typeof runtime.lastActivityAt==='string'?runtime.lastActivityAt:new Date().toISOString()));}
export function resolveRuntimeMetric(value:number|undefined){return typeof value==='number'?value:null}
export function ownerAcceptanceLabel(label:string):string{return label.replace(/Runtime Monitor/gi,'运行监控').replace(/persistent center surface/gi,'中心区固定显示').replace(/not a tab replacement/gi,'不作为标签页替代').replace(/implementation/gi,'实施').replace(/validation/gi,'验证').replace(/owner/gi,'Owner').replace(/Codex/gi,'Codex')}
function acceptance(wp:FormalWorkPackage|null,runtime:RuntimeRecord|null){
  if(!wp)return {progress:null,items:[]};
  const raw=wp.sections['Acceptance Criteria']??'';const lines=raw.split(/\n|(?<=\.)\s+(?=-\s)/).map(v=>v.replace(/^\s*[-*]\s*/,'').trim()).filter(Boolean);
  if(!lines.length)return {progress:null,items:[]};
  const active=runtime?['STARTING','RUNNING','STOPPING'].includes(runtime.phase):false;
  const done=runtime?.phase==='COMPLETED'&&runtime.codeChangePresent===true;
  const items=lines.map(label=>({label,state:done?'PASS':active?'PENDING':'UNAVAILABLE',evidence:done?'runtime completed with code-change evidence':active?'等待可观测 Runtime 证据':'当前没有可验证的实施验收证据'} as AcceptanceEvidence));
  return {progress:done?100:0,items};
}
export function buildRuntimeObserver(runtime:RuntimeRecord|null,wp:FormalWorkPackage|null,lock:WriterLockState,now=Date.now()):RuntimeObserverModel{
  if(!runtime)return {status:'ABSENT',summary:'暂无运行记录',elapsedMs:null,activity:'不可用',events:[],process:'UNKNOWN',metrics:{agentMessages:null,commands:null,fileChanges:null,toolCalls:null,errors:null},health:'UNAVAILABLE',writerLock:lock,acceptance:acceptance(wp,null),terminal:null};
  const active=['STARTING','RUNNING','STOPPING'].includes(runtime.phase);const status=active?'ACTIVE':runtime.phase==='COMPLETED'?'COMPLETED':runtime.phase==='STOPPED'?'STOPPED':'FAILED';
  const end=runtime.completedAt?Date.parse(runtime.completedAt):now;const elapsed=Date.parse(runtime.startedAt);const age=Date.parse(runtime.lastActivityAt);const health=runtime.phase==='STARTING'&&now-elapsed>15000?'STARTUP_TIMEOUT':status==='FAILED'?'FAILED':active&&now-age>30000?'SILENT':'HEALTHY';
  const terminal=[runtime.failure,runtime.implementationResult,runtime.stderr,runtime.finalAgentMessage].filter(Boolean).join('\n')||null;
  return {status,summary:status==='ACTIVE'?'Codex 正在运行':status==='COMPLETED'?'Codex 已完成':status==='FAILED'?'Codex 运行失败':status==='STOPPED'?'Codex 已停止':'Codex Runtime',elapsedMs:Number.isFinite(elapsed)?Math.max(0,end-elapsed):null,activity:resolveCurrentActivity(runtime),events:normalizeRuntimeEvents(runtime),process:runtime.pidAlive===true&&active?'ALIVE':runtime.pidAlive===false||!active?'DEAD':'UNKNOWN',metrics:{agentMessages:resolveRuntimeMetric(runtime.agentMessageCount),commands:resolveRuntimeMetric(runtime.commandExecutionCount),fileChanges:resolveRuntimeMetric(runtime.fileChangeEventCount),toolCalls:resolveRuntimeMetric(runtime.toolCallCount),errors:resolveRuntimeMetric(runtime.errorEventCount)},health,writerLock:lock,acceptance:acceptance(wp,runtime),terminal};
}
