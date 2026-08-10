<script lang="ts">import StatusDot from '../StatusDot.svelte';import type {ResolvedEntityContext} from '../../lib/model/entityTypes';export let context:ResolvedEntityContext;</script>
<section class="hero" data-testid="entity-header" data-entity-type={context.type}>
  <span class="kicker">{context.breadcrumb}</span>
  <div class="entity-kind">[{context.type==='milestone'?'MILESTONE':context.type==='work_package'?'WP':'PR'}]</div>
  <h1>{context.displayTitle}</h1>
  {#if context.title!==context.displayTitle}<p>{context.title}</p>{/if}
  <p class="entity-status" aria-label={context.statusLabel}><StatusDot status={context.status} label={false}/><span>{context.statusLabel}</span></p>
  {#if context.type==='work_package'&&context.parentMilestone}<p class="secondary-slogan">Parent Milestone: {context.parentMilestone.title}</p>{/if}
</section>
