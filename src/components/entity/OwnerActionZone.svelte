<script lang="ts">
  import type {ActionEligibility,WorkPackageEntityContext} from '../../lib/model/entityTypes';
  export let context:WorkPackageEntityContext;
  export let busy=false;
  export let codexAvailable=false;
  export let onAction:(id:ActionEligibility['id'])=>void=()=>{};
  export let onNavigate:(tab:string)=>void=()=>{};

  $: authorize=context.availableActions.find(action=>action.id==='AUTHORIZE');
  $: start=context.availableActions.find(action=>action.id==='START_CODEX');
  $: stop=context.availableActions.find(action=>action.id==='STOP_CODEX');
  $: retry=context.availableActions.find(action=>action.id==='RETRY');
  $: runtime=context.runtime;
  $: activeRuntime=Boolean(runtime&&['STARTING','RUNNING','STOPPING'].includes(runtime.phase));
  $: terminalReportPending=Boolean(runtime?.phase==='COMPLETED'&&runtime.exitCode===0&&context.lifecycle.currentStage!=='HUMAN_UAT'&&context.humanUat?.status!=='PASS');
  $: humanUat=context.lifecycle.currentStage==='HUMAN_UAT';
  $: currentAction=activeRuntime
    ? {label:'查看运行',detail:`正在执行 · ${runtime?.runId??'当前运行'}`,tab:'运行',enabled:true,action:null as ActionEligibility['id']|null}
    : terminalReportPending
      ? {label:'查看报告',detail:'运行已完成，正在生成运行报告…',tab:'运行',enabled:true,action:null as ActionEligibility['id']|null}
    : retry?.enabled
      ? {label:'重试',detail:'执行失败，可重新尝试',tab:'运行',enabled:true,action:'RETRY' as ActionEligibility['id']}
      : humanUat
        ? {label:context.humanUat?.status==='IN_PROGRESS'?'查看当前 UAT':'开始人工 UAT',detail:context.humanUat?.status==='IN_PROGRESS'?'正在进行人工验收':'机器执行已完成，等待人工验收',tab:'UAT',enabled:true,action:null as ActionEligibility['id']|null}
        : start?.enabled&&codexAvailable
          ? {label:'启动执行',detail:'准备就绪，可以开始执行',tab:'运行',enabled:true,action:'START_CODEX' as ActionEligibility['id']}
          : authorize?.enabled
            ? {label:'确认授权',detail:'需要 Owner 授权后才能执行',tab:'概览',enabled:true,action:'AUTHORIZE' as ActionEligibility['id']}
            : {label:'启动执行',detail:start?.reasonLabel??'当前状态暂不可执行',tab:'运行',enabled:false,action:null as ActionEligibility['id']|null};

  function activate(){if(currentAction.action)onAction(currentAction.action);else onNavigate(currentAction.tab)}
</script>

<section class="action-zone contextual-action-zone" data-testid="owner-action-zone" data-current-action={currentAction.label}>
  <div class="section-label"><span>当前操作</span><small>{humanUat?'Human UAT 阶段':'Current Action'}</small></div>
  <div class="current-action-summary"><strong>{currentAction.detail}</strong><button class="action primary" class:disabled={!currentAction.enabled} onclick={activate} disabled={busy||!currentAction.enabled}>{currentAction.label}</button></div>
  {#if activeRuntime&&stop?.enabled}<button class="action secondary-action" onclick={()=>onAction('STOP_CODEX')} disabled={busy}>停止</button>{/if}
</section>
