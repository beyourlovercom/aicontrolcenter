<script lang="ts">
  import CanonicalTaskFeedRow from './CanonicalTaskFeedRow.svelte';
  import {projectCanonicalTaskFeed} from '../lib/canonicalTaskFeed.ts';

  export let tasks:Record<string,any>[]=[];
  export let selectedTaskId:string|null=null;
  export let onSelectTask:(taskId:string)=>void=()=>{};
  $: rows=projectCanonicalTaskFeed(tasks);
</script>

<section class="canonical-task-feed" data-testid="canonical-task-feed" aria-label="Unified Canonical Task Feed">
  <div class="canonical-task-feed-count" aria-label="任务数量">{rows.length} 条任务</div>
  {#if rows.length}
    <div class="canonical-task-feed-columns" aria-hidden="true"><span>来源</span><span>状态</span><span>Task</span><span>时间</span><span>实体 / WP 绑定</span></div>
    <div class="canonical-task-feed-list" data-testid="canonical-task-feed-list">
      {#each rows as row (row.taskId)}<CanonicalTaskFeedRow {row} selected={selectedTaskId===row.taskId} {onSelectTask}/>{/each}
    </div>
  {:else}
    <p class="canonical-task-feed-empty" data-testid="canonical-task-feed-empty">当前工作区没有 canonical Task。</p>
  {/if}
</section>

<style>
  .canonical-task-feed{min-width:0;padding:var(--space-4);overflow:hidden;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--surface);box-shadow:var(--shadow-panel)}
  .canonical-task-feed-columns{display:grid;grid-template-columns:minmax(88px,.72fr) minmax(88px,.72fr) minmax(160px,1.7fr) minmax(110px,.85fr) minmax(150px,1.35fr);gap:10px;padding:9px 10px 6px;color:var(--text-3);font:500 9px/1.2 var(--font-tech);letter-spacing:.05em}
  .canonical-task-feed-list{min-width:0;max-height:320px;margin-top:2px;overflow-y:auto;overflow-x:hidden;border:1px solid var(--border-soft);border-radius:var(--radius-sm);scrollbar-gutter:stable}
  .canonical-task-feed-empty{margin:0;padding:13px 10px;color:var(--text-3);font-size:12px}
  @media(max-width:720px){.canonical-task-feed-columns{grid-template-columns:minmax(78px,.65fr) minmax(78px,.65fr) minmax(120px,1.7fr)}.canonical-task-feed-columns span:nth-child(n+4){display:none}}
</style>
