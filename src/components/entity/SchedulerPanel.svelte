<script lang="ts">
  import type {ExecutionSlot,WorkPackageQueueItem} from '../../lib/multiWpScheduler.ts';
  import ProviderIntelligencePanel from '../ProviderIntelligencePanel.svelte';
  import {matchProviders,type ProviderCapability} from '../../lib/providerIntelligence.ts';
  const providers:ProviderCapability[]=[{provider_id:'codex',provider_name:'Codex',supported_execution_types:['IMPLEMENTATION','REVIEW'],supported_languages:[],supported_tools:['terminal','repository'],speed_profile:'FAST',cost_profile:'MEDIUM',reliability_profile:.95,availability:'AVAILABLE'},{provider_id:'opencode',provider_name:'OpenCode',supported_execution_types:['IMPLEMENTATION'],supported_languages:[],supported_tools:['terminal','repository'],speed_profile:'BALANCED',cost_profile:'LOW',reliability_profile:.8,availability:'UNAVAILABLE'}];
  $: intelligence=matchProviders({execution_type:'IMPLEMENTATION',complexity:'MEDIUM',repository_type:'application',runtime_required:true,terminal_required:true,review_required:false,ci_required:false},providers);
  export let queue:WorkPackageQueueItem[]=[];
  export let slots:ExecutionSlot[]=[];
</script>
<section class="scheduler-panel" data-testid="scheduler-panel"><div class="section-label"><span>Scheduler</span><small>Multi Work Package</small></div><div class="scheduler-grid"><div><strong>Queue</strong>{#each queue as item}<div class="scheduler-row"><span>{item.work_package_id}</span><b>{item.status}</b><small>{item.blocked_reason??item.execution_id??'—'}</small></div>{:else}<small>暂无队列任务</small>{/each}</div><div><strong>Slots</strong>{#each slots as slot}<div class="scheduler-row"><span>{slot.slot_id}</span><b>{slot.status}</b><small>{slot.current_execution??'空闲'}</small></div>{:else}<small>暂无执行槽</small>{/each}</div></div><ProviderIntelligencePanel task={{execution_type:'IMPLEMENTATION',complexity:'MEDIUM',repository_type:'application',runtime_required:true,terminal_required:true,review_required:false,ci_required:false}} match={intelligence} {providers}/></section>
<style>
  .scheduler-panel{display:grid;gap:10px}.scheduler-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.scheduler-grid>div{display:grid;gap:6px;padding:10px;border:1px solid var(--border-soft);border-radius:8px}.scheduler-row{display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center;font-size:11px}.scheduler-row small{grid-column:1/-1;color:var(--text-3)}
</style>
