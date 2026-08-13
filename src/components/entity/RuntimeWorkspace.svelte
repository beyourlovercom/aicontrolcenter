<script lang="ts">
  import RuntimeMonitor from '../RuntimeMonitor.svelte';
  import type {FormalWorkPackage,RuntimeRecord,WriterLockState} from '../../lib/model/entityTypes.ts';
  import {selectCanonicalCurrentRuntime} from '../../lib/runtimeSelection.ts';
  import {onMount} from 'svelte';
  import {recordWorkspaceMount} from '../../lib/runtimeLifecycleInstrumentation.ts';
  import {formatOwnerLocalTime} from '../../lib/ownerTime.ts';

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

  let inspectedInboxId:string|null=null,instructionExpandedId:string|null=null,resultExpandedId:string|null=null,copiedRunId:string|null=null,copyTimer:number|undefined;
  onMount(()=>{recordWorkspaceMount();return ()=>{if(copyTimer)clearTimeout(copyTimer)}});
  $: focused=selectCanonicalCurrentRuntime(runtime,history,selectedRunId);
  $: runRecords=[runtime,...history].filter((item):item is RuntimeRecord=>Boolean(item)).filter((item,index,all)=>all.findIndex(candidate=>candidate.runId===item.runId)===index);
  $: runRecords.sort((a,b)=>Date.parse(b.lastActivityAt??b.startedAt)-Date.parse(a.lastActivityAt??a.startedAt));
  $: executionRows=[...bridgeInbox.filter(item=>Boolean(item.runId)).map(item=>({key:`run:${item.runId}`,runId:item.runId,run:runRecords.find(candidate=>candidate.runId===item.runId)??null,inbox:item})),...runRecords.filter(item=>!bridgeInbox.some(inbox=>inbox.runId===item.runId)).map(item=>({key:`run:${item.runId}`,runId:item.runId,run:item,inbox:null}))];
  $: executionRows.sort((a,b)=>Date.parse(b.run?.lastActivityAt??b.run?.startedAt??b.inbox?.updatedAt??b.inbox?.createdAt??'')-Date.parse(a.run?.lastActivityAt??a.run?.startedAt??a.inbox?.updatedAt??a.inbox?.createdAt??''));
  $: inspectedInbox=bridgeInbox.find(item=>item.id===inspectedInboxId)??null;
  $: if(selectedInboxId&&selectedInboxId!==inspectedInboxId&&bridgeInbox.some(item=>item.id===selectedInboxId))inspectedInboxId=selectedInboxId;
  function gateReason(item:any){return item?.error??item?.parseErrors?.[0]??item?.gates?.find((gate:any)=>gate.state!=='PASS')?.reason??'所有 Gate 已通过。'}
  function rawInstruction(item:any){if(item?.rawInstruction)return item.rawInstruction;const instruction=item?.instruction;if(!instruction)return '原始指令不可用（旧记录未保存原文）。';return [`AICC_EXECUTION_V1`,`INSTRUCTION_ID: ${instruction.instructionId}`,`ENTITY_TYPE: ${instruction.entityType}`,`ENTITY_ID: ${instruction.entityId}`,`EXECUTION_TYPE: ${instruction.executionType}`,`REPOSITORY: ${instruction.repository}`,`BRANCH: ${instruction.branch}`,`EXPECTED_HEAD: ${instruction.expectedHead}`,`SANDBOX: ${instruction.sandbox}`,`REQUIRES_AUTHORIZATION: ${instruction.requiresAuthorization}`,'',`INSTRUCTION_BEGIN`,instruction.instructionBody,`INSTRUCTION_END`].join('\n')}
  function runtimeForRun(runId:string|null){return runId?runRecords.find(item=>item.runId===runId)??null:null}
  function inboxForRun(runId:string){return bridgeInbox.find(item=>item.runId===runId)??null}
  function instructionForRun(row:any){return row.run?.instructionText??row.inbox?.rawInstruction??'原始指令不可用（旧记录未保存原文）。'}
  function resultForRun(run:RuntimeRecord|null){return run&&['COMPLETED','FAILED','STOPPED'].includes(run.phase)?run.finalAgentMessage??null:null}
  function formatDuration(start?:string,end?:string){if(!start)return '不可用';const from=Date.parse(start),to=end?Date.parse(end):Date.now();if(!Number.isFinite(from)||!Number.isFinite(to))return '不可用';const seconds=Math.max(0,Math.floor((to-from)/1000));return `${Math.floor(seconds/60)}分${String(seconds%60).padStart(2,'0')}秒`}
  function toggleInstruction(id:string){instructionExpandedId=instructionExpandedId===id?null:id}
  async function copyRunResult(runId:string){const run=runtimeForRun(runId),result=resultForRun(run);if(!result)return;resultExpandedId=runId;try{if(!navigator.clipboard?.writeText)throw new Error('CLIPBOARD_UNAVAILABLE');await navigator.clipboard.writeText(result);copiedRunId=runId;if(copyTimer)clearTimeout(copyTimer);copyTimer=window.setTimeout(()=>copiedRunId=null,1800)}catch{copiedRunId=null}}
</script>

<section class="runtime-workspace" data-testid="runtime-tab-workspace">
  {#if showInbox}
    <section class="runtime-command-panel" data-testid="runtime-execution-inbox">
      <div class="section-label"><span>执行指令</span><small>AICC_EXECUTION_V1</small></div>
      <textarea value={bridgePayload} oninput={(event)=>onPayloadChange((event.currentTarget as HTMLTextAreaElement).value)} placeholder="粘贴 AICC_EXECUTION_V1，或复制有效示例…"></textarea>
      <div class="runtime-command-actions"><button class="service-action" onclick={onCopyExample}>复制有效示例</button><button class="service-action" onclick={onImport}>导入指令</button></div>
      {#each bridgeInbox.filter(item=>!item.runId).slice(0,5) as item, index}
        <article class="bridge-item bridge-inbox-item" class:latest={index===0} data-testid="inbox-item-{item.id}"><div class="bridge-inbox-summary"><div class="bridge-inbox-heading"><strong>{item.instruction?.sourceType==='WEB_BRIDGE'?'WEB_BRIDGE':item.instruction?.sourceType??'UNKNOWN'} · {item.state}</strong>{#if index===0}<span class="bridge-latest">最新</span>{/if}<time>{formatOwnerLocalTime(item.createdAt??item.updatedAt)}</time></div><b>{item.id}</b><span>{item.instruction?.entityId??item.error??'目标不可用'} · {item.instruction?.executionType??'类型不可用'}</span><small class="bridge-reason">原因：{gateReason(item)}</small></div><div class="bridge-inbox-actions">{#if item.state==='READY'}<button class="service-action" onclick={()=>onLaunch(item.id)}>启动执行</button>{/if}<button class="service-action" onclick={()=>toggleInstruction(`inbox:${item.id}`)}>查看指令</button><button class="service-action" disabled>运行结果</button></div>{#if inspectedInboxId===item.id||instructionExpandedId===`inbox:${item.id}`}<div class="bridge-inbox-detail" data-testid="inbox-detail"><dl><div><dt>来源</dt><dd>{item.instruction?.sourceType??'UNKNOWN'}</dd></div><div><dt>Inbox ID</dt><dd>{item.id}</dd></div><div><dt>Instruction ID</dt><dd>{item.instruction?.instructionId??'—'}</dd></div><div><dt>Entity ID</dt><dd>{item.instruction?.entityId??'—'}</dd></div><div><dt>Inbox State</dt><dd>{item.state}</dd></div><div><dt>Bound Run ID</dt><dd>— · 未启动执行</dd></div></dl><h4>原始指令</h4><pre>{rawInstruction(item)}</pre></div>{/if}</article>
      {/each}
    </section>
  {/if}

  <section class="runtime-current-card" data-testid="runtime-current-execution">
    <div class="section-label"><span>当前执行</span><small>{focused?.runId??'暂无匹配运行'}</small></div>
    {#if focused}<div class="runtime-current-grid"><div><small>状态</small><strong>{focused.phase}</strong></div><div><small>当前活动</small><strong>{focused.currentTask||focused.latestEvent||'UNAVAILABLE'}</strong></div><div><small>Run ID</small><strong class="mono">{focused.runId}</strong></div><div><small>耗时</small><strong>{formatDuration(focused.startedAt,focused.completedAt??(['COMPLETED','FAILED','STOPPED'].includes(focused.phase)?focused.lastActivityAt:undefined))}</strong></div><div><small>PID</small><strong>{focused.pid??'不可用'}</strong></div>{#if ['COMPLETED','FAILED','STOPPED'].includes(focused.phase)}<div><small>退出码</small><strong>{focused.exitCode??'不可用'}</strong></div>{/if}</div><div class="runtime-run-times"><span>开始：{formatOwnerLocalTime(focused.startedAt)}</span>{#if focused.completedAt}<span>结束：{formatOwnerLocalTime(focused.completedAt)}</span>{/if}</div>{:else}<p class="runtime-empty-copy">当前没有绑定到所选实体的运行。</p>{/if}
  </section>

  <section class="runtime-live-section" data-testid="runtime-live-activity">
    <div class="section-label"><span>运行监控 / 实时活动</span><small>Runtime Monitor</small></div>
    <RuntimeMonitor runtime={focused} {workPackage} {writerLock} {emptyTitle} {emptyCapability} {emptyReason}/>
  </section>

  <section class="runtime-history-card" data-testid="runtime-history">
    <div class="section-label"><span>运行记录</span><small>{runRecords.length} 条</small></div>
    {#if executionRows.length}{#each executionRows as row}<article class="runtime-history-item" class:active={row.runId===focused?.runId} data-testid="runtime-run-row-{row.runId}"><button class="runtime-history-select" onclick={()=>row.runId&&onSelectRun(row.runId)}><span><strong>{row.run?.phase??row.inbox?.state??'UNAVAILABLE'}</strong><small>{row.run?.workPackageId??row.inbox?.instruction?.workPackageId??'目标不可用'} · {formatOwnerLocalTime(row.run?.startedAt??row.inbox?.createdAt)}</small></span><code>{row.runId??'—'}</code></button><div class="runtime-run-actions"><button class="service-action" onclick={()=>toggleInstruction(row.runId?`run:${row.runId}`:`inbox:${row.inbox.id}`)}>查看指令</button><button class="service-action" disabled={!resultForRun(row.run)} aria-disabled={!resultForRun(row.run)} onclick={()=>row.runId&&copyRunResult(row.runId)}>运行结果</button>{#if row.runId&&copiedRunId===row.runId}<span class="runtime-copy-feedback" role="status">已复制</span>{/if}</div>{#if instructionExpandedId===`run:${row.runId}`||(!row.runId&&instructionExpandedId===`inbox:${row.inbox.id}`)}<pre class="runtime-instruction-detail" data-testid="runtime-instruction-view-{row.runId??row.inbox.id}">{instructionForRun(row)}</pre>{/if}{#if row.runId&&resultExpandedId===row.runId&&resultForRun(row.run)}<pre class="runtime-result-detail" data-testid="runtime-result-view-{row.runId}">{resultForRun(row.run)}</pre>{/if}</article>{/each}{:else}<p class="runtime-empty-copy">暂无运行记录。</p>{/if}
    {#if showInbox}<div class="runtime-outbox"><div class="section-label"><span>结果发件箱</span><small>AICC_RUN_REPORT_V1</small></div>{#each bridgeOutbox.slice(0,3) as item}<div class="bridge-item"><strong>{item.state}</strong><span>{item.report?.runId??'无 Run ID'}</span><button class="service-action" onclick={()=>onCopyReport(item.report)}>复制报告</button></div>{/each}</div>{/if}
  </section>
</section>
