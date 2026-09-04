<script lang="ts">
  import StatusTabs from '../StatusTabs.svelte';
  import type {AiccStatus} from '../../lib/workflow.ts';
  import type {UiPresentationStatus} from '../../lib/uiLifecycleConsumerProjection.ts';
  export let entityType:'work_package'|'pull_request'='work_package';
  export let activeTab='运行';
  export let statuses:Record<string,AiccStatus|UiPresentationStatus>={};
  export let tabs:string[]=['运行','UAT','概览','证据','授权'];
  export let onSelect:(tab:string)=>void=()=>{};
  export let currentAction='';
</script>

<section class="entity-operations-workspace" data-testid={`entity-operations-workspace-${entityType}`}>
  <div class="entity-workflow-slot"><slot name="workflow"></slot></div>
  <section class="operations-workspace" data-testid="operations-workspace">
    <StatusTabs active={activeTab} {statuses} {tabs} {onSelect}/>
    {#if currentAction}<section class="current-action-slot contextual-action-zone" data-testid="current-action-slot"><div class="section-label"><span>当前操作</span><small>Current Action</small></div><strong>{currentAction}</strong></section>{/if}
    <section class="tab-content" data-testid="active-tab-content"><slot></slot></section>
  </section>
</section>
