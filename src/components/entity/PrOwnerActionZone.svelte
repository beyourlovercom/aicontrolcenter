<script lang="ts">
  import type {ActionId,PullRequestEntityContext} from '../../lib/model/entityTypes';
  export let context:PullRequestEntityContext;
  export let busy=false;
  export let onAction:(id:ActionId)=>void=()=>{};
  export let onNavigate:(tab:string)=>void=()=>{};
  $: start=context.availableActions.find(item=>item.id==='PR_START_CODEX');
  $: stop=context.availableActions.find(item=>item.id==='PR_STOP');
  $: retry=context.availableActions.find(item=>item.id==='PR_RETRY');
  $: running=Boolean(stop?.enabled);
  $: currentAction=running
    ? {label:'查看运行',detail:'PR 正在执行',tab:'运行',action:null as ActionId|null,enabled:true}
    : retry?.enabled
      ? {label:'重试',detail:'PR 执行失败，可重新尝试',tab:'运行',action:'PR_RETRY' as ActionId,enabled:true}
      : start?.enabled
        ? {label:'启动执行',detail:'PR 准备就绪，可以开始执行',tab:'运行',action:'PR_START_CODEX' as ActionId,enabled:true}
        : {label:'准备执行',detail:start?.reasonLabel??'当前 PR 尚未绑定可执行合同',tab:'运行',action:null as ActionId|null,enabled:false};
  function activate(){if(currentAction.action)onAction(currentAction.action);else onNavigate(currentAction.tab)}
</script>

<section class="action-zone contextual-action-zone pr-action-zone" data-testid="pr-owner-action-zone" data-current-action={currentAction.label}>
  <div class="section-label"><span>当前操作</span><small>Current Action</small></div>
  <div class="current-action-summary"><strong>{currentAction.detail}</strong><button class="action primary" class:disabled={!currentAction.enabled} onclick={activate} disabled={busy||!currentAction.enabled}>{currentAction.label}</button></div>
  {#if running&&stop?.enabled}<button class="action secondary-action" onclick={()=>onAction('PR_STOP')} disabled={busy}>停止</button>{/if}
</section>
