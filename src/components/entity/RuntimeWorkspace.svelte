<script lang="ts">
  import RuntimeMonitor from '../RuntimeMonitor.svelte';
  import type {FormalWorkPackage,RuntimeRecord,WriterLockState} from '../../lib/model/entityTypes.ts';
  import {selectCanonicalCurrentRuntime} from '../../lib/runtimeSelection.ts';

  export let runtime:RuntimeRecord|null=null;
  export let history:RuntimeRecord[]=[];
  export let selectedRunId:string|null=null;
  export let selectedInboxId:string|null=null;
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

  let inspectedInboxId:string|null=null;
  $: focused=selectCanonicalCurrentRuntime(runtime,history,selectedRunId);
  $: result=focused?.finalAgentMessage??(focused?.phase==='COMPLETED'?'Codex 运行已完成。':null);
  $: inspectedInbox=bridgeInbox.find(item=>item.id===inspectedInboxId)??null;
  $: if(selectedInboxId&&selectedInboxId!==inspectedInboxId&&bridgeInbox.some(item=>item.id===selectedInboxId))inspectedInboxId=selectedInboxId;
  function gateReason(item:any){return item?.error??item?.parseErrors?.[0]??item?.gates?.find((gate:any)=>gate.state!=='PASS')?.reason??'所有 Gate 已通过。'}
  function rawInstruction(item:any){if(item?.rawInstruction)return item.rawInstruction;const instruction=item?.instruction;if(!instruction)return '原始指令不可用（旧记录未保存原文）。';return [`AICC_EXECUTION_V1`,`INSTRUCTION_ID: ${instruction.instructionId}`,`ENTITY_TYPE: ${instruction.entityType}`,`ENTITY_ID: ${instruction.entityId}`,`EXECUTION_TYPE: ${instruction.executionType}`,`REPOSITORY: ${instruction.repository}`,`BRANCH: ${instruction.branch}`,`EXPECTED_HEAD: ${instruction.expectedHead}`,`SANDBOX: ${instruction.sandbox}`,`REQUIRES_AUTHORIZATION: ${instruction.requiresAuthorization}`,'',`INSTRUCTION_BEGIN`,instruction.instructionBody,`INSTRUCTION_END`].join('\n')}
</script>

<section class="runtime-workspace" data-testid="runtime-tab-workspace">
  {#if showInbox}
    <section class="runtime-command-panel" data-testid="runtime-execution-inbox">
      <div class="section-label"><span>执行指令</span><small>AICC_EXECUTION_V1</small></div>
      <textarea value={bridgePayload} oninput={(event)=>onPayloadChange((event.currentTarget as HTMLTextAreaElement).value)} placeholder="粘贴 AICC_EXECUTION_V1，或复制有效示例…"></textarea>
      <div class="runtime-command-actions"><button class="service-action" onclick={onCopyExample}>复制有效示例</button><button class="service-action" onclick={onImport}>导入指令</button></div>
      {#each bridgeInbox.slice(0,5) as item, index}
        <article class="bridge-item bridge-inbox-item" class:latest={index===0} data-testid="inbox-item-{item.id}"><div class="bridge-inbox-summary"><div class="bridge-inbox-heading"><strong>{item.instruction?.sourceType==='WEB_BRIDGE'?'WEB_BRIDGE':item.instruction?.sourceType??'UNKNOWN'} · {item.state}</strong>{#if index===0}<span class="bridge-latest">最新</span>{/if}</div><b>{item.id}</b><span>{item.instruction?.entityId??item.error??'目标不可用'} · {item.instruction?.executionType??'类型不可用'}</span><small>{item.createdAt??item.updatedAt??'时间不可用'}</small><small class="bridge-reason">原因：{gateReason(item)}</small></div><div class="bridge-inbox-actions">{#if item.state==='READY'}<button class="service-action" onclick={()=>onLaunch(item.id)}>启动执行</button>{/if}<button class="service-action" onclick={()=>inspectedInboxId=inspectedInboxId===item.id?null:item.id}>查看指令</button></div>{#if item.runId}<small class="bridge-run-correlation">Run ID: {item.runId} · {item.runtimeState??item.terminalState??'等待运行'}</small>{:else}<small class="bridge-run-correlation">Run ID: — · 未启动执行</small>{/if}{#if inspectedInboxId===item.id}<div class="bridge-inbox-detail" data-testid="inbox-detail"><dl><div><dt>来源</dt><dd>{item.instruction?.sourceType??'UNKNOWN'}</dd></div><div><dt>Inbox ID</dt><dd>{item.id}</dd></div><div><dt>Instruction ID</dt><dd>{item.instruction?.instructionId??'—'}</dd></div><div><dt>Entity Type</dt><dd>{item.instruction?.entityType??'—'}</dd></div><div><dt>Entity ID</dt><dd>{item.instruction?.entityId??'—'}</dd></div><div><dt>Execution Type</dt><dd>{item.instruction?.executionType??'—'}</dd></div><div><dt>Repository</dt><dd>{item.instruction?.repository??'—'}</dd></div><div><dt>Branch</dt><dd>{item.instruction?.branch??'—'}</dd></div><div><dt>Expected HEAD</dt><dd>{item.instruction?.expectedHead??'—'}</dd></div><div><dt>Sandbox</dt><dd>{item.instruction?.sandbox??'—'}</dd></div><div><dt>Requires Authorization</dt><dd>{String(item.instruction?.requiresAuthorization??'—')}</dd></div><div><dt>Inbox State</dt><dd>{item.state}</dd></div><div><dt>Parser result</dt><dd>{item.instruction?'PARSED':item.state==='INVALID'?'INVALID':'UNAVAILABLE'}</dd></div><div><dt>Gate result</dt><dd>{item.gates?.every((gate:any)=>gate.state==='PASS')?'PASS':gateReason(item)}</dd></div><div><dt>Bound Run ID</dt><dd>{item.runId??'— · 未启动执行'}</dd></div></dl><h4>原始指令</h4><pre>{rawInstruction(item)}</pre></div>{/if}</article>
      {/each}
    </section>
  {/if}

  <section class="runtime-current-card" data-testid="runtime-current-execution">
    <div class="section-label"><span>当前执行</span><small>{focused?.runId??'暂无匹配运行'}</small></div>
    {#if focused}<div class="runtime-current-grid"><div><small>状态</small><strong>{focused.phase}</strong></div><div><small>当前活动</small><strong>{focused.currentTask||'—'}</strong></div><div><small>Run ID</small><strong class="mono">{focused.runId}</strong></div><div><small>PID</small><strong>{focused.pid??'不可用'}</strong></div></div>{:else}<p class="runtime-empty-copy">当前没有绑定到所选实体的运行。</p>{/if}
  </section>

  <section class="runtime-live-section" data-testid="runtime-live-activity">
    <div class="section-label"><span>运行监控 / 实时活动</span><small>Runtime Monitor</small></div>
    <RuntimeMonitor runtime={focused} {workPackage} {writerLock} {emptyTitle} {emptyCapability} {emptyReason}/>
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
