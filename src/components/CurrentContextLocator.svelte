<script lang="ts">
  import type {ResolvedEntityContext} from '../lib/model/entityTypes';
  import type {ExecutionContextLock} from '../lib/executionContext';
  export let context:ResolvedEntityContext;
  export let primaryLabel='';
  export let secondaryLabel='';
  export let roadmapExpanded=true;
  export let onToggleRoadmap:()=>void=()=>{};
  export let onLocate:()=>void=()=>{};
  export let onLocateTask:()=>void=()=>{};
  export let onSyncRoadmap:()=>void=()=>{};
  export let onRefreshTasks:()=>void=()=>{};
  export let selectedTaskId:string|null=null;
  export let onRefreshPr:()=>void=()=>{};
  export let workspace:'BLUEPRINT'|'WP'|'PR'|'TASK'='BLUEPRINT';
  export let roadmapSyncState='';
  export let executionContextLock:ExecutionContextLock={locked:false,entity:null};
  export let onToggleExecutionContextLock:()=>void=()=>{};
</script>
<section class="current-context" class:locked={executionContextLock.locked} data-testid="current-context">
  <div class="current-context-copy">
    <strong title={primaryLabel||context.id}>{primaryLabel||context.id}</strong>
    {#if secondaryLabel}<small title={secondaryLabel}>{secondaryLabel}</small>{/if}
  </div>
  <div class="current-context-actions" aria-label="Roadmap 上下文控制">
    <button class="context-icon-button context-lock-button" class:locked={executionContextLock.locked} aria-label={executionContextLock.locked?'解锁':'锁定'} title={executionContextLock.locked?'解锁':'锁定'} aria-pressed={executionContextLock.locked} onclick={onToggleExecutionContextLock}>{executionContextLock.locked?'🔓':'🔒'}</button>
    <button class="context-icon-button locate-button" aria-label={workspace==='TASK'?(selectedTaskId?'定位当前任务':'暂无当前任务'):'定位到当前上下文'} title={workspace==='TASK'?(selectedTaskId?'定位当前任务':'暂无当前任务'):'定位到当前上下文'} disabled={workspace==='TASK'&&!selectedTaskId} onclick={workspace==='TASK'?onLocateTask:onLocate}>🚩</button>
    <button class="context-icon-button roadmap-expand-button" aria-label={roadmapExpanded?'全部折叠':'全部展开'} title={roadmapExpanded?'全部折叠':'全部展开'} aria-pressed={roadmapExpanded} onclick={onToggleRoadmap}>{roadmapExpanded?'▶️':'↕️'}</button>
    <button class="context-icon-button" aria-label={workspace==='PR'?'刷新PR':workspace==='TASK'?'刷新任务清单':'更新 Roadmap'} title={workspace==='PR'?'刷新PR':workspace==='TASK'?'刷新任务清单':'更新 Roadmap'} onclick={workspace==='PR'?onRefreshPr:workspace==='TASK'?onRefreshTasks:onSyncRoadmap}>🔄</button>
  </div>
</section>
