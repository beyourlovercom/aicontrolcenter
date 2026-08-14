<script lang="ts">
  import type {WorkPackageEntityContext} from '../../lib/model/entityTypes.ts';
  export let context:WorkPackageEntityContext;
  export let repository='不可用';
  $: branch=context.authorization.record?.branch??'当前分支';
  $: authorizationStatus=context.authorization.state==='VALID'?'ARMED':'OFF';
</script>

<div class="authorization-workspace" data-testid="wp-authorization-content">
  <div class="section-label"><span>授权</span><small>Owner 一次性授权</small></div>
  <div class="authorization-grid">
    <section class="auth-card authorization-card" data-testid="git-delivery-authorization">
      <div class="authorization-card-heading"><div><span class="kicker">GIT DELIVERY</span><h3>Git Delivery 授权</h3></div><strong class="authorization-status">{authorizationStatus}</strong></div>
      <dl class="authorization-facts"><div><dt>Repository</dt><dd>{repository}</dd></div><div><dt>Work Package</dt><dd>{context.id}</dd></div><div><dt>Branch</dt><dd>{branch}</dd></div><div><dt>授权生命周期</dt><dd>本次执行 · one execution</dd></div></dl>
      <div class="authorization-copy"><strong>允许操作</strong><p>Local Git checkpoint · Commit · Push · GitHub API / HTTPS access · Create Draft PR</p><strong>明确不包含</strong><p>Merge · Tag · M5 Review authority · M6 autonomous delivery</p></div>
      <div class="authorization-actions"><button class="action primary" disabled>授权 Git Delivery</button><button class="action">授权历史</button></div>
    </section>
    <section class="auth-card authorization-card" data-testid="merge-authorization">
      <div class="authorization-card-heading"><div><span class="kicker">MERGE</span><h3>Merge 授权</h3></div><strong class="authorization-status">OFF</strong></div>
      <dl class="authorization-facts"><div><dt>Repository</dt><dd>{repository}</dd></div><div><dt>Work Package</dt><dd>{context.id}</dd></div><div><dt>Branch / PR</dt><dd>{branch} · 尚未绑定</dd></div></dl>
      <div class="authorization-copy"><p>Merge 授权独立于 Git Delivery，仅在后续适用的生命周期阶段开放。</p></div>
      <div class="authorization-actions"><button class="action primary" disabled>Authorize Merge</button><button class="action">Merge 授权历史</button></div>
    </section>
  </div>
</div>
