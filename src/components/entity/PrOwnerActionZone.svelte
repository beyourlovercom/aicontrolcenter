<script lang="ts">
  import type {ActionId,PullRequestEntityContext} from '../../lib/model/entityTypes';
  export let context:PullRequestEntityContext;
  export let busy=false;
  export let onAction:(id:ActionId)=>void=()=>{};
  export let onNavigate:(tab:string)=>void=()=>{};
  $: create=context.availableActions.find(item=>item.id==='PR_CREATE_DRAFT');
  $: open=context.availableActions.find(item=>item.id==='PR_OPEN');
  $: currentAction=open?.enabled
    ? {label:'查看 PR',detail:context.lifecycleWorkspace.currentAction,tab:'概览',action:'PR_OPEN' as ActionId,enabled:true}
    : create?.enabled
      ? {label:'创建 Draft PR',detail:context.lifecycleWorkspace.currentAction,tab:'概览',action:'PR_CREATE_DRAFT' as ActionId,enabled:true}
    : {label:'查看概览',detail:context.lifecycleWorkspace.currentAction,tab:'概览',action:null as ActionId|null,enabled:false};
  function activate(){if(currentAction.action)onAction(currentAction.action);else onNavigate(currentAction.tab)}
</script>

<section class="action-zone contextual-action-zone pr-action-zone" data-testid="pr-owner-action-zone" data-current-action={currentAction.label}>
  <div class="section-label"><span>当前操作</span><small>Current Action</small></div>
  <div class="current-action-summary"><strong>{currentAction.detail}</strong><button class="action primary" class:disabled={!currentAction.enabled} onclick={activate} disabled={busy||!currentAction.enabled}>{currentAction.label}</button></div>
</section>
