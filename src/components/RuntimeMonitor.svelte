<script lang="ts">
 import type {FormalWorkPackage,RuntimeRecord,WriterLockState} from '../lib/model/entityTypes.ts';
 import {buildRuntimeObserver,runtimeHealthLabel,runtimeStatusLabel,writerLockLabel} from '../lib/runtimeObserver.ts';
 export let runtime:RuntimeRecord|null=null; export let workPackage:FormalWorkPackage|null=null; export let writerLock:WriterLockState={status:'UNAVAILABLE',scope:'repository'};
 $: model=buildRuntimeObserver(runtime,workPackage,writerLock);
 $: elapsed=model.elapsedMs===null?'不可用':`${Math.floor(model.elapsedMs/60000)}m ${Math.floor(model.elapsedMs/1000)%60}s`;
</script>
<section class="runtime-monitor" data-testid="runtime-monitor" data-runtime-status={model.status}>
 <div class="section-label"><span>运行监控</span><small>Runtime Monitor</small></div>
 <div class="runtime-summary"><div><span class="runtime-kicker">{runtimeStatusLabel(model.status)} <small>{model.status}</small></span><h3>{model.summary}</h3><p>当前活动：{model.activity}</p><p>最近活动：{runtime?.lastActivityAt??'不可用'}</p></div><strong>耗时 {elapsed}</strong></div>
 <div class="runtime-health"><span>运行健康 <b class={model.health.toLowerCase()}>{runtimeHealthLabel(model.health)} <small>{model.health}</small></b></span><span>写入锁 <b>{writerLockLabel(model.writerLock.status)} <small>{model.writerLock.status}</small></b></span><span>实施验收 <b>{model.acceptance.progress===null?'不可用':`${model.acceptance.progress}%`}</b></span><span>进程 <b>{model.process==='ALIVE'?'运行中':model.process==='DEAD'?'已结束':'不可用'} <small>{model.process}</small></b></span></div>
 <div class="runtime-metrics">{#each [['Agent 消息',model.metrics.agentMessages],['命令',model.metrics.commands],['变更事件',model.metrics.fileChanges],['工具调用',model.metrics.toolCalls],['错误',model.metrics.errors] ] as metric}<div><small>{metric[0]}</small><strong>{metric[1]===null?'不可用':metric[1]}</strong></div>{/each}</div>
 {#if model.events.length}<div class="runtime-events"><b>实时活动</b>{#each model.events as event}<div><span>{new Date(event.timestamp).toLocaleTimeString('zh-CN',{hour12:false})}　{event.label}</span><code>{event.technicalType}</code></div>{/each}</div>{/if}
 {#if model.acceptance.items.length}<div class="runtime-acceptance"><b>验收清单</b><small>实施验收不代表 Work Package 已完成。</small>{#each model.acceptance.items as item}<div><span class={item.state.toLowerCase()}>{item.state==='PASS'?'✓ 已通过':item.state==='PENDING'?'● 待验证':'○ 尚无证据'}</span><span>{item.label}</span></div>{/each}</div>{/if}
 {#if runtime}<details class="runtime-technical"><summary>技术详情</summary><div>Run ID: {runtime.runId}</div><div>Execution Type: {runtime.executionType??'不可用'} · Sandbox: {runtime.sandboxMode??'不可用'}</div><div>HEAD: {runtime.authorizedHead??runtime.startingHeadSha??'不可用'} · PID: {runtime.pid??'不可用'} · Thread: {runtime.threadId??'不可用'}</div><div>Start: {runtime.startedAt} · End: {runtime.completedAt??'不可用'} · exit code: {runtime.exitCode??'不可用'}</div><div>Implementation: {runtime.implementationResult??'不可用'}</div>{#if runtime.finalAgentMessage}<div>Final Agent Message: <code>{runtime.finalAgentMessage}</code></div>{/if}{#if runtime.stderr}<div>stderr: <code>{runtime.stderr}</code></div>{/if}</details>{/if}
</section>
