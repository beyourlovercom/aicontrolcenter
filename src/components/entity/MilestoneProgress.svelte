<script lang="ts">
  import StatusDot from '../StatusDot.svelte';
  import {getStatusPresentationMeta} from '../../lib/statusPresentation';
  import type {MilestoneEntityContext} from '../../lib/model/entityTypes';
  export let context:MilestoneEntityContext;
  export let onSelect:(id:string)=>void=()=>{};
</script>
<section class="milestone-progress-panel" data-testid="milestone-progress-panel">
  <div class="section-label"><span>Milestone Progress</span><small>{context.summary.complete} / {context.summary.workPackages} Work Packages</small></div>
  {#if context.children.length===0}<p class="milestone-progress-empty">当前里程碑暂无 Work Package。</p>{:else}<div class="milestone-progress-track" style={`--milestone-count:${context.children.length}`}>{#each context.children as child,i}<button class="milestone-progress-node" title={child.id} onclick={()=>onSelect(child.id)}><span class="milestone-progress-dot"><StatusDot status={child.status} label={false}/><b>{i+1}</b></span><strong>{child.title}</strong><small>{getStatusPresentationMeta(child.status).ownerLabel}</small></button>{/each}</div>{/if}
</section>
