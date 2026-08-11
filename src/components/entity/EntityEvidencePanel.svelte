<script lang="ts">
 import type {ResolvedEntityContext,RepositoryState} from '../../lib/model/entityTypes';
 import {runtimeStatusLabel,writerLockLabel} from '../../lib/runtimeObserver.ts';
 import PrEvidencePanel from './PrEvidencePanel.svelte';
 export let context:ResolvedEntityContext; export let repository:RepositoryState|null=null; export let codexInfo:any=null;
</script>
<div data-testid="entity-evidence" data-entity-type={context.type}>
{#if context.type==='milestone'}
 <div class="evidence-intro"><span class="live-dot"></span><strong>里程碑汇总证据</strong></div>
 <div class="evidence-list milestone-metrics"><div><span>进度</span><b class="metric-value">{context.progress!==null?`${context.progress}%`:'—'}</b></div><div><span>Work Packages</span><b class="metric-value">{context.summary.workPackages??'—'}</b></div><div><span>已完成</span><b class="metric-value">{context.summary.complete??'—'}</b></div><div><span>等待 / 进行中</span><b class="metric-value">{context.summary.waiting??'—'}</b></div><div><span>阻塞</span><b class="metric-value">{context.summary.blocked??'—'}</b></div><div><span>Pull Requests</span><b class="metric-value">{context.summary.pullRequests??'—'}</b></div></div>
{:else if context.type==='work_package'}
 <div class="evidence-intro"><span class="live-dot"></span><strong>当前 WP 真实证据</strong></div>
 {#if repository}<div class="evidence-list">{#each [['仓库',repository.repository],['当前分支',repository.branch],['当前 HEAD',repository.head],['工作区',repository.worktree]] as row}<div><span>{row[0]}</span><code>{row[1]}</code></div>{/each}</div>{/if}
 <div class="auth-card"><span class="kicker">OWNER AUTHORIZATION</span>{#if context.authorization.state==='VALID'&&context.authorization.record}<strong>Owner 授权 · 已授权</strong><p>Work Package: {context.authorization.record.workPackageId}<br/>Branch: {context.authorization.record.branch}<br/>Authorized HEAD: {context.authorization.record.headShaAtAuthorization.slice(0,7)}<br/>Current HEAD: {repository?.head.slice(0,7)??'UNAVAILABLE'}</p>{:else}<strong>当前 WP 无有效授权</strong><p>{context.authorization.reasonCode??context.authorization.state}</p>{/if}</div>
 <div class="auth-card runtime-card"><span class="kicker">运行证据</span>{#if context.runtime}<strong>{runtimeStatusLabel(context.runtime.phase==='COMPLETED'?'COMPLETED':context.runtime.phase==='FAILED'?'FAILED':context.runtime.phase==='STOPPED'?'STOPPED':'ACTIVE')}</strong><div class="runtime-list"><div><span>Run ID</span><code>{context.runtime.runId}</code></div>{#if ['STARTING','RUNNING','STOPPING'].includes(context.runtime.phase)}<div><span>进程</span><b>{context.runtime.pidAlive===true?'运行中':'不可用'}</b></div>{:else}<div><span>退出码</span><b>{context.runtime.exitCode??'不可用'}</b></div>{/if}<div><span>写入锁</span><b>{writerLockLabel(context.writerLock.status)}</b></div></div>{:else}<strong>无匹配运行证据</strong><p>Codex CLI · {codexInfo?.available?'可用':'不可用'}</p>{/if}</div>
 <div class="runtime-list"><div><span>写入锁（仓库级）</span><b>{writerLockLabel(context.writerLock.status)} <small>{context.writerLock.status}</small></b></div><div><span>验证</span><b>{context.lifecycle.stages.find(stage=>stage.id==='VALIDATION')?.status}</b></div><div><span>人工 UAT</span><b>{context.humanUat?.status??'不可用 / 不存在'}</b></div><div><span>关联 PR</span><b>{context.relatedPullRequests.length}</b></div></div>
{:else}<PrEvidencePanel context={context}/>{/if}
</div>
