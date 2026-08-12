<script lang="ts">
  import RuntimeMonitor from '../RuntimeMonitor.svelte';
  import type {FormalWorkPackage,RuntimeRecord,WriterLockState} from '../../lib/model/entityTypes.ts';

  export let runtime:RuntimeRecord|null=null;
  export let history:RuntimeRecord[]=[];
  export let selectedRunId:string|null=null;
  export let workPackage:FormalWorkPackage|null=null;
  export let writerLock:WriterLockState={status:'UNAVAILABLE',scope:'repository'};
  export let bridgeInbox:any[]=[];
  export let bridgeOutbox:any[]=[];
  export let bridgePayload='';
  export let showInbox=true;
  export let emptyTitle='暂无运行记录';
  export let emptyCapability='不可用';
  export let emptyReason='';
  export let onPayloadChange:(value:string)=>void=()=>{};
  export let onCopyExample:()=>void=()=>{};
  export let onImport:()=>void=()=>{};
  export let onLaunch:(id:string)=>void=()=>{};
  export let onCopyReport:(report:unknown)=>void=()=>{};
  export let onSelectRun:(id:string)=>void=()=>{};

  $: focused=history.find(item=>item.runId===selectedRunId)??runtime??history[0]??null;
  $: result=focused?.finalAgentMessage??(focused?.phase==='COMPLETED'?'Codex 运行已完成。':null);
</script>

<section class="runtime-workspace" data-testid="runtime-tab-workspace">
  {#if showInbox}
    <section class="runtime-command-panel" data-testid="runtime-execution-inbox">
      <div class="section-label"><span>执行指令</span><small>AICC_EXECUTION_V1</small></div>
      <textarea value={bridgePayload} oninput={(event)=>onPayloadChange((event.currentTarget as HTMLTextAreaElement).value)} placeholder="粘贴 AICC_EXECUTION_V1，或复制有效示例…"></textarea>
      <div class="runtime-command-actions"><button class="service-action" onclick={onCopyExample}>复制有效示例</button><button class="service-action" onclick={onImport}>导入指令</button></div>
      {#each bridgeInbox.slice(0,5) as item}
        <div class="bridge-item"><strong>{item.state}</strong><span>{item.instruction?.workPackageId??item.error??item.id}</span>{#if item.state==='READY'}<button class="service-action" onclick={()=>onLaunch(item.id)}>启动执行</button>{:else if item.runId}<small>Run: {item.runId} · {item.runtimeState??item.terminalState??'等待运行'}</small>{/if}</div>
      {/each}
    </section>
  {/if}

  <section class="runtime-current-card" data-testid="runtime-current-execution">
    <div class="section-label"><span>当前执行</span><small>{focused?.runId??'暂无匹配运行'}</small></div>
    {#if focused}<div class="runtime-current-grid"><div><small>状态</small><strong>{focused.phase}</strong></div><div><small>当前活动</small><strong>{focused.currentTask||'—'}</strong></div><div><small>Run ID</small><strong class="mono">{focused.runId}</strong></div><div><small>PID</small><strong>{focused.pid??'不可用'}</strong></div></div>{:else}<p class="runtime-empty-copy">当前没有绑定到所选实体的运行。</p>{/if}
  </section>

  <section class="runtime-live-section" data-testid="runtime-live-activity">
    <div class="section-label"><span>运行监控 / 实时活动</span><small>Runtime Monitor</small></div>
    <RuntimeMonitor runtime={runtime} {workPackage} {writerLock} {emptyTitle} {emptyCapability} {emptyReason}/>
  </section>

  <section class="runtime-result-card" data-testid="runtime-run-result">
    <div class="section-label"><span>执行结果</span><small>{focused?.runId??'无 Run ID'}</small></div>
    {#if result}<p>{result}</p>{:else if focused?.phase&&['STARTING','RUNNING','STOPPING'].includes(focused.phase)}<p>运行尚未产生终态报告。</p>{:else}<p class="runtime-empty-copy">暂无执行结果。</p>{/if}
  </section>

  <section class="runtime-history-card" data-testid="runtime-history">
    <div class="section-label"><span>历史运行</span><small>{history.length} 条</small></div>
    {#if history.length}{#each history as item}<button class:active={item.runId===focused?.runId} class="runtime-history-item" onclick={()=>onSelectRun(item.runId)}><span><strong>{item.phase}</strong><small>{item.startedAt}</small></span><code>{item.runId}</code></button>{/each}{:else}<p class="runtime-empty-copy">暂无历史运行。</p>{/if}
    {#if showInbox}<div class="runtime-outbox"><div class="section-label"><span>结果发件箱</span><small>AICC_RUN_REPORT_V1</small></div>{#each bridgeOutbox.slice(0,3) as item}<div class="bridge-item"><strong>{item.state}</strong><span>{item.report?.runId??'无 Run ID'}</span><button class="service-action" onclick={()=>onCopyReport(item.report)}>复制报告</button></div>{/each}</div>{/if}
  </section>
</section>
