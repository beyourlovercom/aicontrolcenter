<script lang="ts">
  export let taskId:string|null|undefined=null;
  export let label='UNKNOWN / UNMAPPED';
  export let selected=false;
  export let onSelect:(taskId:string)=>void=()=>{};

  $: normalizedTaskId=typeof taskId==='string'?taskId.trim():'';
  $: canonicalTaskId=normalizedTaskId&&!['UNKNOWN','UNMAPPED','UNKNOWN_TASK','UNKNOWN / UNMAPPED','NOT_AVAILABLE'].includes(normalizedTaskId.toUpperCase())?normalizedTaskId:null;
</script>

{#if canonicalTaskId}
  <button class="task-title-trigger" class:selected type="button" data-testid={`task-title-trigger-${canonicalTaskId}`} aria-label={`查看 Task ${label}`} aria-pressed={selected} title={label} onclick={()=>onSelect(canonicalTaskId)}>{label}</button>
{:else}
  <span class="task-title-unresolved" data-testid="task-title-unresolved" title={label}>{label}</span>
{/if}

<style>
  .task-title-trigger,.task-title-unresolved{display:block;width:100%;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:inherit;text-align:left}
  .task-title-trigger{padding:0;border:0;border-radius:3px;background:transparent;color:inherit;cursor:pointer}
  .task-title-trigger:hover{color:var(--accent);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px}
  .task-title-trigger:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .task-title-trigger.selected{color:var(--accent)}
  .task-title-unresolved{color:inherit}
</style>
