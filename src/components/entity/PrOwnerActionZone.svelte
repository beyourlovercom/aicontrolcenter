<script lang="ts">
  import type {ActionId,PullRequestEntityContext} from '../../lib/model/entityTypes';
  export let context:PullRequestEntityContext;
  export let busy=false;
  export let onAction:(id:ActionId)=>void=()=>{};
  export let onNavigate:(tab:string)=>void=()=>{};
  $: create=context.availableActions.find(item=>item.id==='PR_CREATE_DRAFT');
  $: open=context.availableActions.find(item=>item.id==='PR_OPEN');
  $: currentAction=open?.enabled
    ? {label:'PR 信息',detail:'当前 PR 已绑定真实远端身份',tab:'概览',action:'PR_OPEN' as ActionId,enabled:true}
    : create?.enabled
      ? {label:'创建 Draft PR',detail:'Owner 可显式请求 Codex 创建 Draft PR',tab:'概览',action:'PR_CREATE_DRAFT' as ActionId,enabled:true}
      : {label:'等待 PR 身份',detail:create?.reasonLabel??'PR 创建执行不可用',tab:'概览',action:null as ActionId|null,enabled:false};
  function activate(){if(currentAction.action)onAction(currentAction.action);else onNavigate(currentAction.tab)}
</script>

<section class="action-zone contextual-action-zone pr-action-zone" data-testid="pr-owner-action-zone" data-current-action={currentAction.label}>
  <div class="section-label"><span>当前操作</span><small>Current Action</small></div>
  <div class="current-action-summary"><strong>{currentAction.detail}</strong><button class="action primary" class:disabled={!currentAction.enabled} onclick={activate} disabled={busy||!currentAction.enabled}>{currentAction.label}</button></div>
</section>
