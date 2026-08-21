<script lang="ts">
  import TaskTitleTrigger from './TaskTitleTrigger.svelte';
  import {formatOwnerLocalTime} from '../lib/ownerTime.ts';
  import type {CanonicalTaskFeedRow as FeedRow} from '../lib/canonicalTaskFeed.ts';

  export let row:FeedRow;
  export let selected=false;
  export let onSelectTask:(taskId:string)=>void=()=>{};
  $: statusClass=row.status.toLowerCase().replace(/[^a-z0-9_-]+/g,'-');
</script>

<div class="canonical-task-feed-row" data-testid={`canonical-task-feed-row-${row.taskId}`} data-canonical-source={row.canonicalSource}>
  <span class="task-source-chip" title={row.canonicalSource}>{row.sourceLabel}</span>
  <span class={`task-status-chip task-status-${statusClass}`}>{row.status}</span>
  <div class="task-feed-title"><TaskTitleTrigger taskId={row.taskId} label={row.title} {selected} onSelect={onSelectTask}/></div>
  <time title={row.activityAt??'时间不可用'}>{row.activityAt?formatOwnerLocalTime(row.activityAt):'时间不可用'}</time>
  <span class="task-feed-binding" title={row.bindingLabel}>{row.bindingLabel}</span>
</div>

<style>
  .canonical-task-feed-row{display:grid;grid-template-columns:minmax(88px,.72fr) minmax(88px,.72fr) minmax(160px,1.7fr) minmax(110px,.85fr) minmax(150px,1.35fr);align-items:center;gap:10px;min-width:0;min-height:36px;padding:6px 10px;border-top:1px solid var(--border-soft);color:var(--text-2);font-size:11px}
  .canonical-task-feed-row:first-child{border-top:0}.canonical-task-feed-row:hover{background:var(--surface-soft)}
  .task-source-chip,.task-status-chip{min-width:0;overflow:hidden;padding:4px 7px;border-radius:999px;text-overflow:ellipsis;white-space:nowrap;font:600 9px/1 var(--font-tech);letter-spacing:.03em}
  .task-source-chip{background:var(--surface-2);color:var(--text-2)}.task-status-chip{background:#eef1f4;color:var(--text-2)}
  .task-status-completed{background:#e8f6ef;color:#24724d}.task-status-running,.task-status-starting{background:#eaf3fd;color:#235e95}.task-status-failed,.task-status-stopped,.task-status-blocked{background:#fff0ec;color:#a6412d}
  .task-feed-title,.task-feed-binding,time{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.task-feed-title{color:var(--text-1);font-weight:600}.task-feed-binding,time{color:var(--text-3);font-family:var(--font-tech)}
  @media(max-width:720px){.canonical-task-feed-row{grid-template-columns:minmax(78px,.65fr) minmax(78px,.65fr) minmax(120px,1.7fr)}.canonical-task-feed-row time,.task-feed-binding{display:none}}
</style>
