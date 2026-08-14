<script lang="ts">
  import type {WorkPackageEntityContext} from '../../lib/model/entityTypes.ts';
  export let context:WorkPackageEntityContext;
</script>

<section class="overview wp-detail-view" data-testid="wp-work-package-content">
  <div class="section-label"><span>Work Package detail</span><small>Read-only normalized source</small></div>
  {#if context.formalWorkPackage}
    <article class="detail-card"><div class="detail-top"><span class="tag">{context.id}</span><span class="truth">FORMAL READY</span></div><h3>{context.formalWorkPackage.title}</h3><p class="source-path">{context.formalWorkPackage.source}</p><div class="detail-grid"><div><b>Goal / Scope</b><p>{context.formalWorkPackage.sections.Goal??'未提供'}</p></div><div><b>Status</b><p>{context.formalWorkPackage.fields.Status??'未提供'}</p></div><div><b>Dependencies</b><p>{context.formalWorkPackage.sections.Dependencies??'未提供'}</p></div><div><b>Acceptance Criteria</b><p>{context.formalWorkPackage.sections['Acceptance Criteria']??'未提供'}</p></div></div></article>
  {:else}
    <article class="detail-card"><div class="detail-top"><span class="tag">{context.id}</span><span class="kicker">PLANNED_ONLY</span></div><h3>Roadmap Work Package</h3><p>当前仅存在于 Roadmap；尚无有效正式可执行 Work Package 文件。</p></article>
  {/if}
</section>
