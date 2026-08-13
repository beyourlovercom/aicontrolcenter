<script lang="ts">
  import type {GlobalTaskGroups,GlobalTaskGroup} from '../lib/globalTaskView.ts';
  export let groups:GlobalTaskGroups={inProgress:[],waitingOwner:[],needsAction:[],recentCompleted:[]};
  export let onNavigate:(workPackageId:string)=>void=()=>{};
  let expanded=true;
  const definitions:{key:GlobalTaskGroup;label:string}[]=[{key:'inProgress',label:'进行中'},{key:'waitingOwner',label:'等待 Owner'},{key:'needsAction',label:'需要处理'},{key:'recentCompleted',label:'最近完成'}];
</script>
<section class="global-task-view" data-testid="global-task-view">
  <button class="global-task-header" aria-expanded={expanded} onclick={()=>expanded=!expanded}><span><span class="kicker">GLOBAL TASKS</span><strong>全局任务</strong></span><span>{expanded?'收起':'展开'}</span></button>
  {#if expanded}<div class="global-task-groups">{#each definitions as definition}<section class="global-task-group" data-group={definition.key}><div class="global-task-group-title"><span>{definition.label}</span><small>{groups[definition.key].length}</small></div>{#if groups[definition.key].length}{#each groups[definition.key] as item}<button class="global-task-item" disabled={!item.workPackageId} title={item.scope==='UNKNOWN'?'范围未知，尚未绑定实体':item.label} onclick={()=>item.workPackageId&&onNavigate(item.workPackageId)}><span>{item.label}</span><small>{item.workPackageId??'UNKNOWN'}{item.runId?` · ${item.runId}`:''}</small></button>{/each}{:else}<p class="global-task-empty">暂无任务</p>{/if}</section>{/each}</div>{/if}
</section>
<style>
  .global-task-view{margin:0 20px 12px;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--surface);box-shadow:var(--shadow-panel)}
  .global-task-header{display:flex;width:100%;align-items:center;justify-content:space-between;padding:12px;border:0;background:transparent;color:var(--text-1);text-align:left;cursor:pointer}
  .global-task-header>span:first-child{display:grid;gap:2px}.global-task-header strong{font:600 14px/1.3 var(--font-ui)}.global-task-header>span:last-child{color:var(--text-3);font-size:11px}
  .global-task-groups{display:grid;gap:10px;padding:0 12px 12px}.global-task-group{min-width:0}.global-task-group-title{display:flex;justify-content:space-between;padding:5px 0;color:var(--text-2);font:600 12px/1.3 var(--font-ui)}.global-task-group-title small{color:var(--text-3);font:500 11px var(--font-tech)}
  .global-task-item{display:flex;width:100%;justify-content:space-between;gap:8px;padding:6px 0;border:0;border-top:1px solid var(--border-soft);background:transparent;color:var(--text-1);text-align:left;cursor:pointer}.global-task-item:disabled{color:var(--text-3);cursor:default}.global-task-item span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.global-task-item small{flex:0 0 auto;color:var(--text-3);font:10px var(--font-tech)}.global-task-empty{margin:0;padding:5px 0;color:var(--text-3);font-size:11px}
</style>
