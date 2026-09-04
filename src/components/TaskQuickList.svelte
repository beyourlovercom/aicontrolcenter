<script lang="ts">
  import type {CanonicalTaskRecord} from '../lib/bridgeCore.ts';
  import {taskDisplayName,taskHasCanonicalResult,taskStatusIcon,taskStatusLabel} from '../lib/taskPresentation.ts';
  import {filterTaskQuickList} from '../lib/taskQuickListSearch.ts';

  export let tasks:CanonicalTaskRecord[]=[];
  export let selectedTaskId:string|null=null;
  export let onSelect:(taskId:string)=>void=()=>{};
  export let onCopyResult:(task:CanonicalTaskRecord)=>void=()=>{};
  let searchQuery='';
  $: visibleTasks=filterTaskQuickList(tasks,searchQuery);

</script>

<section class="task-quick-list" data-testid="task-quick-list">
  <div class="task-quick-heading"><strong>任务清单</strong><small>{tasks.length}</small></div>
  <label class="task-quick-search"><span aria-hidden="true">⌕</span><input aria-label="搜索任务名称 / ID" placeholder="搜索任务名称 / ID..." value={searchQuery} oninput={(event)=>searchQuery=(event.currentTarget as HTMLInputElement).value}/></label>
  <div class="task-quick-columns"><span>任务名称</span><span>状态</span><span>结果</span></div>
  <div class="task-quick-rows" data-testid="task-quick-list-rows">
    {#each visibleTasks as task (task.taskId)}
      {@const status=String(task.status??'READY').toUpperCase()}
      <div class:selected={selectedTaskId===task.taskId} class="task-quick-row" data-testid={`task-quick-row-${task.taskId}`}>
        <button class="task-quick-name" title={taskDisplayName(task)} onclick={()=>onSelect(task.taskId)}>{taskDisplayName(task)}</button>
        <button class="task-quick-status" title={taskStatusLabel(status)} aria-label={taskStatusLabel(status)} onclick={()=>onSelect(task.taskId)}>{taskStatusIcon(status)}</button>
        {#if taskHasCanonicalResult(task)}
          <button class="task-quick-result" title="复制运行结果" aria-label="复制运行结果" onclick={()=>onCopyResult(task)}>📋</button>
        {:else}
          <span class="task-quick-result unavailable" title="暂无运行结果" aria-label="暂无运行结果">🈚</span>
        {/if}
      </div>
    {:else}
      <p class="task-quick-empty">{searchQuery.trim()?'没有匹配的任务':'暂无任务。'}</p>
    {/each}
  </div>
</section>

<style>
  .task-quick-list{display:grid;gap:10px;height:100%;min-height:0;padding:14px 10px;background:var(--surface);border-radius:var(--radius-md);box-shadow:var(--shadow-panel)}
  .task-quick-heading{display:flex;align-items:center;justify-content:space-between;padding:0 8px}.task-quick-heading strong{font-size:17px}.task-quick-heading small{min-width:28px;padding:4px 7px;border-radius:8px;background:var(--surface-2);color:var(--text-2);text-align:center;font:600 12px var(--font-tech)}
  .task-quick-search{display:flex;align-items:center;gap:8px;margin:0 8px;padding:0 10px;border:1px solid var(--border);border-radius:8px;color:var(--text-3);font-size:12px}.task-quick-search input{width:100%;min-width:0;padding:9px 0;border:0;outline:0;background:transparent;color:var(--text-1);font:inherit}.task-quick-search input::placeholder{color:var(--text-3)}
  .task-quick-columns,.task-quick-row{display:grid;grid-template-columns:minmax(0,1fr) 42px 42px;align-items:center;gap:6px}.task-quick-columns{padding:0 10px;color:var(--text-3);font-size:10px}.task-quick-columns span:nth-child(2),.task-quick-columns span:nth-child(3){text-align:center}
  .task-quick-rows{min-height:0;overflow-y:auto;border-top:1px solid var(--border-soft);border-bottom:1px solid var(--border-soft)}.task-quick-row{min-height:38px;padding:4px 8px;border-bottom:1px solid var(--border-soft);background:var(--surface);color:var(--text-1)}.task-quick-row:last-child{border-bottom:0}.task-quick-row:hover,.task-quick-row.selected{background:var(--surface-2);box-shadow:inset 2px 0 var(--accent)}
  .task-quick-name{min-width:0;overflow:hidden;border:0;background:transparent;color:inherit;text-align:left;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;font-size:12px}.task-quick-status,.task-quick-result{display:grid;place-items:center;width:30px;height:28px;padding:0;border:0;background:transparent;cursor:pointer;font-size:16px}.task-quick-result.unavailable{cursor:default;filter:grayscale(1);opacity:.65}.task-quick-empty{padding:10px;color:var(--text-3);font-size:12px}
</style>
