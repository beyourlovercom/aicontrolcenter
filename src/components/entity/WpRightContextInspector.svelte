<script lang="ts">
  import {getContext} from 'svelte';
  import type {WorkPackageEntityContext} from '../../lib/model/entityTypes.ts';
  import {getStatusPresentationMeta} from '../../lib/statusPresentation.ts';
  import {presentationStatus} from '../../lib/uiLifecycleConsumerProjection.ts';
  type UiReadModel={lifecycleStatus:(kind:any,id:string,dimension:any)=>string};
  const ui=getContext<UiReadModel>('AICC_UI_LIFECYCLE_READ_MODEL');
  export let context:WorkPackageEntityContext;
  export let onClear:()=>void=()=>{};
  export let onOpen:()=>void=()=>{};
  $: wpLifecycle=ui?.lifecycleStatus('WORK_PACKAGE',context.id,'wp.lifecycle')??'UNKNOWN';
  $: uatLifecycle=ui?.lifecycleStatus('HUMAN_UAT',`work_package:${context.id}`,'humanUat.lifecycle')??'UNKNOWN';
  $: phase=context.phaseProgress;
  $: statusLabel=getStatusPresentationMeta(presentationStatus(wpLifecycle)).ownerLabel;
  const value=(entry:string|null|undefined)=>entry&&entry!=='UNKNOWN'?entry:'NOT_AVAILABLE';
</script>

<section class="wp-right-inspector" data-testid="wp-right-context-inspector">
  <header class="wp-right-header"><div><span>WORK PACKAGE</span><h3>{context.title}</h3><code title={context.id}>{context.id}</code></div><button aria-label="清除 Work Package 选择" title="清除 Work Package 选择" onclick={onClear}>×</button></header>
  <section class="wp-right-card"><h4>Current Status</h4><strong>{statusLabel}</strong><dl><dt>Current Phase</dt><dd>{phase?.currentPhaseTitle??'No phase plan'}</dd><dt>Progress</dt><dd>{phase?`${phase.completedCount} / ${phase.totalPhases} phases`:'No phase plan'}</dd></dl>{#if phase}<span class="wp-right-bar"><i style={`width:${phase.totalPhases?phase.completedCount/phase.totalPhases*100:0}%`}></i></span>{:else}<span class="wp-right-bar"></span>{/if}</section>
  <section class="wp-right-card"><h4>Lifecycle</h4><dl><dt>WP</dt><dd>{value(wpLifecycle)}</dd><dt>Owner UAT</dt><dd>{value(uatLifecycle)}</dd><dt>PR</dt><dd>{context.relatedPullRequests.length?context.relatedPullRequests.map(pr=>pr.id).join(', '):'NOT_AVAILABLE'}</dd><dt>Task</dt><dd>NOT_AVAILABLE</dd><dt>Run</dt><dd>NOT_AVAILABLE</dd><dt>Result</dt><dd>NOT_AVAILABLE</dd></dl></section>
  <section class="wp-right-card"><h4>Current Execution</h4><dl><dt>Task</dt><dd>NOT_AVAILABLE</dd><dt>Execution</dt><dd>NOT_AVAILABLE</dd><dt>Run</dt><dd>NOT_AVAILABLE</dd><dt>Runtime</dt><dd>NOT_AVAILABLE</dd><dt>Result</dt><dd>NOT_AVAILABLE</dd></dl></section>
  <section class="wp-right-card"><h4>Blockers &amp; Next Action</h4><dl><dt>Blockers</dt><dd>NOT_AVAILABLE</dd><dt>Next Action</dt><dd>NOT_AVAILABLE</dd></dl></section>
  <section class="wp-right-card"><h4>Evidence Summary</h4><p>NOT_AVAILABLE</p></section>
  <footer><button title="Open WP Workspace" onclick={onOpen}>Open WP Workspace</button></footer>
</section>

<style>
  .wp-right-inspector{display:grid;gap:10px;padding:18px 16px;min-width:0}.wp-right-header{display:flex;justify-content:space-between;gap:8px;min-width:0}.wp-right-header>div{min-width:0}.wp-right-header span{color:var(--text-3);font:600 10px var(--font-tech)}.wp-right-header h3{margin:5px 0 3px;font-size:14px;line-height:1.3}.wp-right-header code{display:block;overflow:hidden;color:var(--text-2);font:10px/1.3 var(--font-tech);text-overflow:ellipsis;white-space:nowrap}.wp-right-header button{width:26px;height:26px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text-2);cursor:pointer}.wp-right-card{min-width:0;padding:10px;border:1px solid var(--border-soft);border-radius:var(--radius-sm);background:var(--surface-soft)}.wp-right-card h4{margin:0 0 8px;font-size:12px}.wp-right-card>strong{color:var(--accent-ink);font:600 13px var(--font-tech)}.wp-right-card p{margin:0;color:var(--text-2);font-size:12px}.wp-right-card dl{display:grid;grid-template-columns:86px minmax(0,1fr);gap:5px 8px;margin:9px 0 0;font-size:11px}.wp-right-card dt{color:var(--text-3)}.wp-right-card dd{min-width:0;margin:0;overflow:hidden;color:var(--text-1);text-overflow:ellipsis;white-space:nowrap}.wp-right-bar{display:block;height:5px;margin-top:9px;overflow:hidden;border-radius:999px;background:var(--border)}.wp-right-bar i{display:block;height:100%;background:var(--accent)}.wp-right-inspector footer{position:sticky;bottom:0;padding-top:4px;background:var(--surface)}.wp-right-inspector footer button{width:100%;min-height:36px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-soft);color:var(--text-3);cursor:not-allowed}
</style>
