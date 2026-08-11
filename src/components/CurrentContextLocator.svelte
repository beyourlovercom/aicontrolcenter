<script lang="ts">
  import type {ResolvedEntityContext} from '../lib/model/entityTypes';
  export let context:ResolvedEntityContext;
  export let onLocate:()=>void=()=>{};
  $: secondary=context.type==='work_package'?context.parentMilestone?.title:context.type==='pull_request'?`Parent: ${context.parentWorkPackageId??'未匹配'}`:'';
  $: title=context.type==='milestone'?context.title:context.type==='pull_request'?context.title:context.displayTitle;
</script>
<section class="current-context" data-testid="current-context"><div class="current-context-header"><div class="current-context-label">当前定位 <span>Current Context</span></div><button class="locate-button" onclick={onLocate} aria-label="定位到 Roadmap">定位</button></div><div class="current-context-row" title={title}><strong>{title}</strong></div>{#if secondary}<small>{secondary}</small>{/if}</section>
