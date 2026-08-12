<script lang="ts">
  import StatusTabs from '../StatusTabs.svelte';
  import type {AiccStatus} from '../../lib/workflow.ts';
  export let entityType:'work_package'|'pull_request'='work_package';
  export let activeTab='概览';
  export let statuses:Record<string,AiccStatus>={};
  export let tabs:string[]=['概览','流程','工作包','运行','验证','UAT','证据'];
  export let onSelect:(tab:string)=>void=()=>{};
</script>

<section class="entity-operations-workspace" data-testid={`entity-operations-workspace-${entityType}`}>
  <div class="entity-workflow-slot"><slot name="workflow"></slot></div>
  <section class="operations-workspace" data-testid="operations-workspace">
    <StatusTabs active={activeTab} {statuses} {tabs} {onSelect}/>
    <section class="tab-content" data-testid="active-tab-content"><slot></slot></section>
  </section>
</section>
