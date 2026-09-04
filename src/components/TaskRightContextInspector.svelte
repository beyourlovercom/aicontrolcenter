<script lang="ts">
  import GlobalTaskDetail from './GlobalTaskDetail.svelte';

  export let task:any=null;
  export let runtime:any=null;
  export let report:any=null;
  export let resultProjection:any=null;
  export let onClose:()=>void=()=>{};
  export let onViewWorkPackage:(id:string)=>void=()=>{};

  $: taskId=task?.taskId??task?.id??'UNKNOWN_TASK';
  $: status=String(task?.status??task?.runtimeState??task?.terminalState??task?.state??'UNKNOWN');
</script>

<section class="task-context-inspector" data-testid="task-right-context-inspector" aria-label="Selected Task Detail">
  <header class="task-inspector-header">
    <div>
      <span class="kicker">SELECTED TASK</span>
      <h2>Selected Task Detail</h2>
    </div>
    <button class="task-inspector-close" type="button" aria-label="关闭任务详情" onclick={onClose}>×</button>
  </header>
  <div class="task-inspector-identity">
    <strong>{taskId}</strong>
    <span class={`task-state task-state-${status.toLowerCase()}`}>{status}</span>
  </div>
  <div class="task-inspector-scroll">
    <GlobalTaskDetail {task} {runtime} {report} {resultProjection} embedded {onViewWorkPackage}/>
  </div>
</section>

<style>
  .task-context-inspector{position:sticky;top:0;display:grid;width:100%;min-width:0;max-width:100%;height:calc(100vh - 64px);min-height:0;grid-template-rows:auto auto minmax(0,1fr);overflow:hidden;box-sizing:border-box;background:var(--surface)}
  .task-context-inspector>*{min-width:0;max-width:100%;box-sizing:border-box}
  .task-inspector-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:24px 20px 14px;border-bottom:1px solid var(--border-soft)}
  .task-inspector-header>div{min-width:0}
  .task-inspector-header h2{margin:5px 0 0;font:650 16px/1.3 var(--font-ui);letter-spacing:-.02em}
  .task-inspector-close{display:grid;flex:0 0 auto;width:44px;height:44px;margin:-10px -10px 0 0;place-items:center;border:0;border-radius:8px;background:transparent;color:var(--text-3);font-size:23px;line-height:1;cursor:pointer}
  .task-inspector-close:hover{background:var(--surface-2);color:var(--text-1)}
  .task-inspector-identity{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 20px;border-bottom:1px solid var(--border-soft)}
  .task-inspector-identity strong{min-width:0;overflow:hidden;font:600 11px/1.4 var(--font-tech);text-overflow:ellipsis;white-space:nowrap}
  .task-state{flex:0 0 auto;padding:5px 8px;border-radius:6px;background:var(--surface-2);color:var(--text-2);font:600 9px/1 var(--font-tech);letter-spacing:.04em}
  .task-state-completed{background:#e8f6ef;color:#24724d}.task-state-running,.task-state-starting{background:#eaf3fd;color:#235e95}.task-state-failed,.task-state-stopped{background:#fff0ec;color:#a6412d}
  .task-inspector-scroll{min-width:0;max-width:100%;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable}
  @media(max-width:900px){.task-context-inspector{height:100%}}
</style>
