<script lang="ts">
  import type {ActionId,PullRequestEntityContext} from '../../lib/model/entityTypes';
  export let context:PullRequestEntityContext;
  export let busy=false;
  export let onAction:(id:ActionId)=>void=()=>{};
  const action=(id:ActionId)=>context.availableActions.find(item=>item.id===id);
</script>
<section class="action-zone pr-action-zone" data-testid="pr-owner-action-zone">
  <div class="section-label"><span>PR Owner Action Zone</span><small>显式 PR 操作</small></div>
  <div class="actions">
    <button class="action primary" onclick={()=>onAction('REFRESH')} aria-label="刷新状态" disabled={busy}>刷新状态</button>
    {#each [['PR_OPEN','打开 PR'],['PR_RETRY','重试'],['PR_STOP','停止'],['PR_APPROVE_MERGE','批准合并']] as item}
      {@const eligibility=action(item[0] as ActionId)}
      <button class:disabled={!eligibility?.enabled} class="action pr-action" title={eligibility?.reasonLabel??eligibility?.reasonCode??item[1]} aria-label={item[1]} onclick={()=>onAction(item[0] as ActionId)}>{item[1]}</button>
    {/each}
  </div>
</section>
