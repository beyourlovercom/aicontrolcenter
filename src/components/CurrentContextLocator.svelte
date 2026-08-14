<script lang="ts">
  import type {ResolvedEntityContext} from '../lib/model/entityTypes';
  import type {ExecutionContextLock} from '../lib/executionContext';
  export let context:ResolvedEntityContext;
  export let onLocate:()=>void=()=>{};
  export let executionContextLock:ExecutionContextLock={locked:false,entity:null};
  export let onToggleExecutionContextLock:()=>void=()=>{};
  $: secondary=context.type==='work_package'?context.parentMilestone?.title:context.type==='pull_request'?`Parent: ${context.parentWorkPackageId??'未匹配'}`:'';
  $: title=context.type==='milestone'?context.title:context.type==='pull_request'?context.title:context.displayTitle;
</script>
<section class="current-context" data-testid="current-context"><div class="current-context-header"><div class="current-context-label">当前定位 <span>Current Context</span></div><div class="current-context-actions"><button class="context-lock-button" class:locked={executionContextLock.locked} onclick={onToggleExecutionContextLock} aria-label={executionContextLock.locked?'解锁执行上下文':'锁定执行上下文'}>{executionContextLock.locked?'已锁定':'锁定'}</button><button class="locate-button" onclick={onLocate} aria-label="定位到 Roadmap">定位</button></div></div><div class="current-context-row" title={title}><strong>{title}</strong></div>{#if secondary}<small>{secondary}</small>{/if}{#if executionContextLock.locked&&executionContextLock.entity}<small class="execution-context-lock-label">执行上下文：{executionContextLock.entity.type==='work_package'?'WP':executionContextLock.entity.type==='pull_request'?'PR':'Milestone'} · {executionContextLock.entity.id}</small>{/if}</section>
