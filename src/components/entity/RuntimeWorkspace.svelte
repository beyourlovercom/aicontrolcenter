<script lang="ts">
  import RuntimeMonitor from '../RuntimeMonitor.svelte';
  import type {FormalWorkPackage,RuntimeRecord,WriterLockState} from '../../lib/model/entityTypes.ts';
  import {selectCanonicalCurrentRuntime} from '../../lib/runtimeSelection.ts';
  import {getContext,onMount} from 'svelte';
  import {recordWorkspaceMount} from '../../lib/runtimeLifecycleInstrumentation.ts';
  import {formatOwnerLocalTime} from '../../lib/ownerTime.ts';
  import ExecutionProviderPanel from './ExecutionProviderPanel.svelte';
  import CanonicalTaskFeed from '../CanonicalTaskFeed.svelte';
  import TaskTitleTrigger from '../TaskTitleTrigger.svelte';
  import CodexCliLive from '../CodexCliLive.svelte';
  import RuntimeDiagnostics from '../RuntimeDiagnostics.svelte';
  const EXECUTION_PROVIDER_STORAGE_KEY='aicc-selected-execution-provider';
  const readExecutionProvider=(): 'LOCAL_CODEX'|'REMOTE_CLAUDE' => {const value=typeof localStorage==='undefined'?null:localStorage.getItem(EXECUTION_PROVIDER_STORAGE_KEY);return value==='REMOTE_CLAUDE'?'REMOTE_CLAUDE':'LOCAL_CODEX'};
  import {buildRuntimeDiagnostic} from '../../lib/runtimeDiagnostics.ts';
  import AiccWorkspaceDrawer from '../AiccWorkspaceDrawer.svelte';
  import {createEmptyGlobalStateReadModel,type GlobalStateProjectContext} from '../../lib/globalStateReadModel.ts';
  import {exactResultForRun,exactRunLayer2,projectPhase5Lifecycle} from '../../lib/runtimeResultFeedbackControlLoopProjection.ts';

  export let projectContext:GlobalStateProjectContext|null=null;
  export let runtime:RuntimeRecord|null=null;
  export let history:RuntimeRecord[]=[];
  export let entityType:'global_task'|'work_package'|'pull_request'='work_package';
  export let entityId='';
  export let selectedRunId:string|null=null;
  export let selectedInboxId:string|null=null;
  export let workPackage:FormalWorkPackage|null=null;
  export let writerLock:WriterLockState={status:'UNAVAILABLE',scope:'repository'};
  export let bridgeInbox:any[]=[];
  export let bridgeOutbox:any[]=[];
  export let tasks:any[]=[];
  export let selectedTaskId:string|null=null;
  export let onSelectTask:(taskId:string)=>void=()=>{};
  export let showCanonicalTaskFeed=true;
  export let bridgePayload='';
  export let instructionState:'TEXT_READY'|'IMPORTED_PENDING'|'RUN_STARTED'|'RESULT_RECEIVED'='TEXT_READY';
  export let showInbox=true;
  export let showComposer=true;
  export let emptyTitle='暂无运行记录';
  export let emptyCapability='不可用';
  export let emptyReason='';
  export let onPayloadChange:(value:string)=>void=()=>{};
  export let onPasteInstruction:()=>void=()=>{};
  export let onImportInstruction:()=>void=()=>{};
  export let onManualExecute:()=>void=()=>{};
  export let onComposerSend:()=>Promise<unknown>|unknown=async()=>{await onImportInstruction()};
  const appStopExactRuntime=getContext<(runId:string)=>Promise<unknown>|unknown>('aicc-stop-exact-runtime');
  const appResumeExactRuntime=getContext<(runId:string)=>Promise<unknown>|unknown>('aicc-resume-exact-runtime');
  export let onStop:(runId:string)=>Promise<unknown>|unknown=appStopExactRuntime??(()=>{throw new Error('APP_STOP_EXACT_RUNTIME_REQUIRED')});
  export let onResume:(runId:string)=>Promise<unknown>|unknown=appResumeExactRuntime??(()=>{throw new Error('APP_RESUME_EXACT_RUNTIME_REQUIRED')});
  export let onImportAndRun:()=>void=()=>{};
  export let onCopyResult:(runId?:string)=>void=()=>{};
  export let onCopyExample:()=>void=()=>{};
  export let onLaunch:(id:string)=>void=()=>{};
  export let onCopyReport:(report:unknown)=>void=()=>{};
  export let onSelectRun:(id:string)=>void=()=>{};
  export let providerId:'LOCAL_CODEX'|'REMOTE_CLAUDE'=readExecutionProvider();
  export let onProviderChange:(provider:'LOCAL_CODEX'|'REMOTE_CLAUDE')=>void=(provider)=>{try{localStorage.setItem(EXECUTION_PROVIDER_STORAGE_KEY,provider)}catch{}};
  let modelOptions:{value:string;label:string;model:string;reasoning:string}[]=[],selectedModel='',selectedReasoning='',composerSubmitting=false,imeComposing=false;
  let resultExpandedId:string|null=null,copiedRunId:string|null=null,copyTimer:number|undefined;
  let phase5Layer2:ReturnType<typeof projectPhase5Lifecycle>|null=null;
  let phase5ContextKey:string|null=null;
  $: {const key=projectContext?`${projectContext.projectId}|${projectContext.repositoryIdentity}|${projectContext.projectContextRevision}`:null;if(key!==phase5ContextKey){phase5ContextKey=key;phase5Layer2=projectContext?projectPhase5Lifecycle(createEmptyGlobalStateReadModel(projectContext),{}):null;}}
  $: contextRuntime=projectContext&&runtime&&runtime.projectId===projectContext.projectId&&runtime.repositoryIdentity===projectContext.repositoryIdentity?runtime:null;
  $: contextHistory=projectContext?history.filter(item=>item.projectId===projectContext!.projectId&&item.repositoryIdentity===projectContext!.repositoryIdentity):[];
  $: currentSubmittedRun=instructionState==='RUN_STARTED'&&contextRuntime&&selectedRunId===contextRuntime.runId&&!['COMPLETED','FAILED','STOPPED','RECOVERY_REQUIRED'].includes(contextRuntime.phase)?contextRuntime:null;
  $: liveComposerRun=contextRuntime&&contextRuntime.pidAlive===true&&['STARTING','RUNNING','STOPPING'].includes(contextRuntime.phase)?contextRuntime:null;
  $: cancellableComposerRun=currentSubmittedRun??liveComposerRun;
  $: activeComposerState=composerSubmitting?'SUBMITTING':cancellableComposerRun?.phase==='STARTING'?'STARTING':cancellableComposerRun?.phase==='RUNNING'?'RUNNING':cancellableComposerRun?.phase==='STOPPING'?'STOPPING':bridgePayload.trim()?'TEXT_READY':'EMPTY';
  onMount(async()=>{recordWorkspaceMount();try{const response=await fetch('/api/providers/codex');const payload=await response.json();modelOptions=(payload.models??[]).flatMap((item:any)=>(item.reasoningLevels??[]).map((reasoning:string)=>({value:`${item.model}:${reasoning}`,label:`${item.displayName} · ${reasoning}`,model:item.model,reasoning})));const savedModel=localStorage.getItem('aicc-selected-model')??payload.defaultModel,savedReasoning=localStorage.getItem('aicc-selected-reasoning')??payload.defaultReasoning;const saved=modelOptions.find(item=>item.model===savedModel&&item.reasoning===savedReasoning)??modelOptions[0];if(saved){selectedModel=saved.model;selectedReasoning=saved.reasoning}}catch{modelOptions=[]}return ()=>{if(copyTimer)clearTimeout(copyTimer)}});
  function persistSelection(value:string){const selected=modelOptions.find(item=>item.value===value);if(!selected)return;selectedModel=selected.model;selectedReasoning=selected.reasoning;if(typeof localStorage!=='undefined'){localStorage.setItem('aicc-selected-model',selected.model);localStorage.setItem('aicc-selected-reasoning',selected.reasoning)}}
  async function submitComposer(){if(activeComposerState!=='TEXT_READY'||composerSubmitting)return;composerSubmitting=true;try{await Promise.resolve(onComposerSend())}finally{composerSubmitting=false}}
  function onComposerKeydown(event:KeyboardEvent){if(event.key!=='Enter'||event.shiftKey||event.isComposing||imeComposing)return;if(activeComposerState!=='TEXT_READY')return;event.preventDefault();void submitComposer()}
  $: focused=projectContext?selectCanonicalCurrentRuntime(contextRuntime,contextHistory,selectedRunId):null;
  function rebuildPhase5Projection(current:RuntimeRecord|null,taskRecords:any[],previous:ReturnType<typeof projectPhase5Lifecycle>|null){if(!previous||!projectContext)return previous;const next=projectPhase5Lifecycle(previous.model,{runs:current?[current]:[],tasks:taskRecords.map(task=>({taskId:task.taskId,lifecycle:task.status,executionId:task.executionId,runId:task.runId,updatedAt:task.updatedAt}))});phase5Layer2=next;return next;}
  $: lifecycleProjection=rebuildPhase5Projection(focused,tasks,phase5Layer2);
  $: focusedRunLayer2=focused&&lifecycleProjection?exactRunLayer2(lifecycleProjection,focused.runId):null;
  $: focusedRunLifecycle=focusedRunLayer2?.lifecycle.state==='KNOWN'?focusedRunLayer2.lifecycle.value:'UNKNOWN';
  $: focusedExecutionLayer2=focusedRunLayer2?.executionId?lifecycleProjection?.executions.find(record=>record.executionId===focusedRunLayer2?.executionId)??null:null;
  $: focusedExecutionLifecycle=focusedExecutionLayer2?.lifecycle.state==='KNOWN'?focusedExecutionLayer2.lifecycle.value:'UNKNOWN';
  let stopPending=false,resumePending=false;
  async function stopFocusedRuntime(runId:string){if(!focused?.runId||focused.runId!==runId||stopPending)return;stopPending=true;try{await Promise.resolve(onStop(runId))}finally{stopPending=false}}
  async function resumeFocusedRuntime(runId:string){if(!focused?.runId||focused.runId!==runId||resumePending)return;resumePending=true;try{await Promise.resolve(onResume(runId))}finally{resumePending=false}}
  $: focusedResult=focused?exactResultForRun(lifecycleProjection,focused.runId)?.canonical?.rawResult??null:null;
  $: focusedTask=focused?tasks.find(task=>task?.runId===focused.runId||task?.executionId===focused.runId)??null:null;
  $: diagnostic=buildRuntimeDiagnostic(focusedTask??tasks.find(task=>task?.taskId===selectedTaskId)??null,focused);
  $: if(resultExpandedId&&resultExpandedId!==focused?.runId)resultExpandedId=null;
  function runtimeForRun(runId:string|null){return runId?[contextRuntime,...contextHistory].find(item=>item?.runId===runId)??null:null}
  function resultForRun(run:RuntimeRecord|null){return run&&['COMPLETED','FAILED','STOPPED'].includes(run.phase)?run.canonicalResult?.rawResult??null:null}
  async function copyResult(runId=focused?.runId){if(!runId||!resultForRun(runtimeForRun(runId)))return;await onCopyResult(runId);copiedRunId=runId;if(copyTimer)clearTimeout(copyTimer);copyTimer=window.setTimeout(()=>copiedRunId=null,1600)}
  function formatDuration(start?:string,end?:string){if(!start)return '不可用';const from=Date.parse(start),to=end?Date.parse(end):Date.now();if(!Number.isFinite(from)||!Number.isFinite(to))return '不可用';const seconds=Math.max(0,Math.floor((to-from)/1000));return `${Math.floor(seconds/60)}分${String(seconds%60).padStart(2,'0')}秒`}
</script>

<section class="runtime-workspace" data-testid="runtime-tab-workspace">
  {#if showInbox && showComposer}
    <section class="runtime-command-panel" data-testid="runtime-execution-inbox">
      <div class="runtime-top-action-bar" data-testid="runtime-top-action-bar"><div><button class="service-action" onclick={onPasteInstruction}>粘贴指令</button><button class="service-action" onclick={onImportInstruction}>发送到 AICC 执行</button></div><div><button class="service-action" onclick={onCopyResult}>复制结果</button><button class="service-action" onclick={onCopyExample}>复制有效示例</button></div></div>
      <textarea value={bridgePayload} oninput={(event)=>onPayloadChange((event.currentTarget as HTMLTextAreaElement).value)} onkeydown={onComposerKeydown} oncompositionstart={()=>imeComposing=true} oncompositionend={()=>imeComposing=false} placeholder="粘贴 AICC_EXECUTION_V1，或复制有效示例…"></textarea>
      <div class="runtime-composer-controls" data-testid="runtime-composer-controls"><span class="runtime-composer-state" data-testid="runtime-composer-state">{activeComposerState}</span><select class="runtime-model-selector" aria-label="模型与推理" value={`${selectedModel}:${selectedReasoning}`} onchange={(event)=>persistSelection((event.currentTarget as HTMLSelectElement).value)} disabled={!modelOptions.length}>{#each modelOptions as option}<option value={option.value}>{option.label}</option>{/each}</select><button class:stop-action={activeComposerState==='STARTING'||activeComposerState==='RUNNING'||activeComposerState==='STOPPING'} class:send-action={activeComposerState==='TEXT_READY'} class="runtime-primary-action" data-testid="runtime-primary-action" disabled={activeComposerState==='EMPTY'||activeComposerState==='SUBMITTING'||activeComposerState==='STOPPING'} aria-label={activeComposerState==='STARTING'||activeComposerState==='RUNNING'||activeComposerState==='STOPPING'?'停止回答':'发送'} onclick={activeComposerState==='STARTING'||activeComposerState==='RUNNING'?onStop:submitComposer}>{activeComposerState==='STARTING'||activeComposerState==='RUNNING'||activeComposerState==='STOPPING'?'■':'↑'}</button></div>
    </section>
  {/if}

  {#if showCanonicalTaskFeed}<AiccWorkspaceDrawer title="统一任务列表" subtitle="Canonical Task Feed" defaultExpanded={true}><CanonicalTaskFeed {tasks} {selectedTaskId} {onSelectTask}/></AiccWorkspaceDrawer>{/if}

  <AiccWorkspaceDrawer title="Codex CLI Live" subtitle="Runtime Terminal" defaultExpanded={true}><div class="runtime-terminal-pane" data-testid="runtime-terminal-pane"><CodexCliLive runtime={focused} lifecycle={focusedRunLifecycle} onStop={stopFocusedRuntime} onResume={resumeFocusedRuntime} {stopPending} {resumePending}/></div></AiccWorkspaceDrawer>

  <AiccWorkspaceDrawer title="运行摘要" subtitle="Runtime Monitor" defaultExpanded={false}><section class="runtime-live-section" data-testid="runtime-live-activity"><RuntimeMonitor runtime={focused} runLayer2={focusedRunLayer2} {workPackage} {writerLock} {emptyTitle} {emptyCapability} {emptyReason} resultText={focusedResult} resultExpanded={resultExpandedId===focused?.runId} copied={copiedRunId===focused?.runId} onToggleResult={(expanded)=>{if(focused?.runId)resultExpandedId=expanded?focused.runId:null}} onCopyResult={()=>copyResult(focused?.runId)}/></section></AiccWorkspaceDrawer>

  <AiccWorkspaceDrawer title="故障诊断" subtitle="Runtime Diagnostics" defaultExpanded={false}><RuntimeDiagnostics diagnostic={diagnostic}/></AiccWorkspaceDrawer>

  <AiccWorkspaceDrawer title="当前执行" subtitle={focused?.runId??'暂无匹配运行'} defaultExpanded={false}><section class="runtime-current-card" data-testid="runtime-current-execution">
    {#if focused}<dl class="aicc-info-list runtime-current-info"><div class="aicc-info-row"><dt class="aicc-info-label">实体绑定</dt><dd class="aicc-info-value" title={entityType==='global_task'?'GLOBAL / UNMAPPED':`${entityType.toUpperCase()} · ${entityId||workPackage?.id||'UNBOUND'}`}>{entityType==='global_task'?'GLOBAL / UNMAPPED':`${entityType.toUpperCase()} · ${entityId||workPackage?.id||'UNBOUND'}`}</dd></div><div class="aicc-info-row"><dt class="aicc-info-label">Execution 状态</dt><dd class="aicc-info-value">{focusedExecutionLifecycle}</dd></div><div class="aicc-info-row"><dt class="aicc-info-label">Run 状态</dt><dd class="aicc-info-value">{focusedRunLifecycle}</dd></div>{#if focusedTask}<div class="aicc-info-row"><dt class="aicc-info-label">Canonical Task</dt><dd class="aicc-info-value"><TaskTitleTrigger taskId={focusedTask.taskId} label={focusedTask.taskTitle??focusedTask.taskCode??focusedTask.instructionId??focusedTask.taskId} selected={selectedTaskId===focusedTask.taskId} onSelect={onSelectTask}/></dd></div>{/if}<div class="aicc-info-row"><dt class="aicc-info-label">当前活动</dt><dd class="aicc-info-value" title={focused.currentTask||focused.latestEvent||'UNAVAILABLE'}>{focused.currentTask||focused.latestEvent||'UNAVAILABLE'}</dd></div><div class="aicc-info-row"><dt class="aicc-info-label">Run ID</dt><dd class="aicc-info-value" title={focused.runId}>{focused.runId}</dd></div><div class="aicc-info-row"><dt class="aicc-info-label">耗时</dt><dd class="aicc-info-value">{formatDuration(focused.startedAt,focused.completedAt??(['COMPLETED','FAILED','STOPPED'].includes(focusedRunLifecycle)?focused.lastActivityAt:undefined))}</dd></div><div class="aicc-info-row"><dt class="aicc-info-label">PID</dt><dd class="aicc-info-value">{focused.pid??'不可用'}</dd></div>{#if ['COMPLETED','FAILED','STOPPED'].includes(focusedRunLifecycle)}<div class="aicc-info-row"><dt class="aicc-info-label">退出码</dt><dd class="aicc-info-value">{focused.exitCode??'不可用'}</dd></div>{/if}<div class="aicc-info-row"><dt class="aicc-info-label">开始时间</dt><dd class="aicc-info-value">{formatOwnerLocalTime(focused.startedAt)}</dd></div>{#if focused.completedAt}<div class="aicc-info-row"><dt class="aicc-info-label">结束时间</dt><dd class="aicc-info-value">{formatOwnerLocalTime(focused.completedAt)}</dd></div>{/if}</dl>{:else}<p class="runtime-empty-copy">{entityType==='global_task'?'当前没有未绑定的全局运行。':'当前没有绑定到所选实体的运行。'}</p>{/if}
  </section></AiccWorkspaceDrawer>

  {#if focused}
    <AiccWorkspaceDrawer title="执行证据" subtitle="RUN-SCOPED" defaultExpanded={false}><section class="runtime-evidence-card" data-testid="runtime-execution-evidence">
      <dl class="aicc-info-list runtime-evidence-info"><div class="aicc-info-row"><dt class="aicc-info-label">Provider</dt><dd class="aicc-info-value">{focused.provider??'codex'}</dd></div><div class="aicc-info-row"><dt class="aicc-info-label">Requested model</dt><dd class="aicc-info-value">{focused.requestedModel??focused.model??'UNAVAILABLE'}</dd></div><div class="aicc-info-row"><dt class="aicc-info-label">Resolved model</dt><dd class="aicc-info-value">{focused.resolvedModel??'UNAVAILABLE'}</dd></div><div class="aicc-info-row"><dt class="aicc-info-label">Reasoning</dt><dd class="aicc-info-value">{focused.reasoningLevel??'UNAVAILABLE'}</dd></div><div class="aicc-info-row"><dt class="aicc-info-label">Spawn</dt><dd class="aicc-info-value" title={focused.spawnExecutable??'UNAVAILABLE'}>{focused.spawnExecutable??'UNAVAILABLE'} · {focused.spawnedAt??'PENDING'}</dd></div><div class="aicc-info-row"><dt class="aicc-info-label">PID</dt><dd class="aicc-info-value">{focused.pid??'UNAVAILABLE'} · {focused.pidAlive===true?'ALIVE':'DEAD'}</dd></div><div class="aicc-info-row"><dt class="aicc-info-label">工作目录</dt><dd class="aicc-info-value" title={focused.spawnCwd??focused.worktreePath??'UNAVAILABLE'}>{focused.spawnCwd??focused.worktreePath??'UNAVAILABLE'}</dd></div><div class="aicc-info-row"><dt class="aicc-info-label">启动状态</dt><dd class="aicc-info-value" title={focused.startupTransitions?.join(' → ')??'UNAVAILABLE'}>{focused.startupTransitions?.join(' → ')??'UNAVAILABLE'}</dd></div><div class="aicc-info-row"><dt class="aicc-info-label">退出</dt><dd class="aicc-info-value">{focused.exitCode??'—'} {focused.processSignal??''}</dd></div><div class="aicc-info-row"><dt class="aicc-info-label">Failure</dt><dd class="aicc-info-value">{focused.failure??'—'}</dd></div><div class="aicc-info-row"><dt class="aicc-info-label">Codex thread</dt><dd class="aicc-info-value">{focused.threadId??'—'}</dd></div><div class="aicc-info-row"><dt class="aicc-info-label">Process exit / close</dt><dd class="aicc-info-value">{focused.processExitObserved?'EXITED':'—'} · {focused.processCloseObserved?'CLOSED':'—'}</dd></div><div class="aicc-info-row"><dt class="aicc-info-label">Writer Lock</dt><dd class="aicc-info-value">{focused.writerLockReleased?'RELEASED':'ACTIVE / UNKNOWN'}</dd></div><div class="aicc-info-row"><dt class="aicc-info-label">Timeout</dt><dd class="aicc-info-value">{focused.timeoutAt??'—'}</dd></div><div class="aicc-info-row"><dt class="aicc-info-label">Startup decision</dt><dd class="aicc-info-value">{focused.startupDetectorDecision??'PENDING'} · {focused.readyEvent??'—'}</dd></div></dl>
      {#if focused.stdout}<details><summary>stdout</summary><pre>{focused.stdout}</pre></details>{/if}
      {#if focused.stderr}<details><summary>stderr</summary><pre>{focused.stderr}</pre></details>{/if}
      {#if focused.rawFirstStdoutEvents?.length}<details><summary>first protocol events</summary><pre>{focused.rawFirstStdoutEvents.join('\n')}</pre></details>{/if}
    </section></AiccWorkspaceDrawer>
  {/if}

  <AiccWorkspaceDrawer title="Execution Provider" subtitle="Provider Registry" defaultExpanded={false}><ExecutionProviderPanel {providerId} status={focused?focusedRunLifecycle:'IDLE'} executionType={focused?.executionType??'IMPLEMENTATION'} {onProviderChange}/></AiccWorkspaceDrawer>
</section>
<style>
  .runtime-evidence-card pre{max-height:180px;overflow:auto;white-space:pre-wrap;font:11px var(--font-tech)}
  .runtime-composer-controls{display:flex;justify-content:flex-end;align-items:center;gap:10px;margin-top:8px}.runtime-composer-state{margin-right:auto;color:var(--text-3);font:11px var(--font-tech)}.runtime-model-selector{max-width:190px;border:1px solid var(--border-soft);border-radius:6px;background:var(--surface);color:var(--text);padding:5px 8px;font-size:11px}.runtime-primary-action{width:34px;height:34px;border:0;border-radius:50%;font-size:17px;line-height:1;background:#94a3b8;color:white;cursor:pointer}.runtime-primary-action.send-action,.runtime-primary-action.stop-action{background:#2563eb}.runtime-primary-action:disabled{background:#cbd5e1;color:#64748b;cursor:not-allowed}
</style>
