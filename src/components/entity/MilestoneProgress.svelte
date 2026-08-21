<script lang="ts">
  import {getContext} from 'svelte';
  import StatusDot from '../StatusDot.svelte';
  import {getStatusPresentationMeta} from '../../lib/statusPresentation';
  import {presentationStatus} from '../../lib/uiLifecycleConsumerProjection.ts';
  import type {MilestoneEntityContext} from '../../lib/model/entityTypes';
  type UiLifecycleContext={lifecycleStatus:(kind:'WORK_PACKAGE',id:string,dimension:'wp.lifecycle'|'wp.progress')=>string};
  const uiLifecycleContext=getContext<UiLifecycleContext>('AICC_UI_LIFECYCLE_READ_MODEL');
  export let context:MilestoneEntityContext;
  export let selectedWorkPackageId:string|null=null;
  export let onSelect:(id:string)=>void=()=>{};
  export let onOpen:(id:string)=>void=()=>{};
  $: workPackages=context.children.filter(child=>child.type==='work_package');
  $: groupedWorkPackages=context.roadmapGroups.map(group=>({group,items:workPackages.filter(child=>child.roadmapGroupNumber===group.number).map(child=>({child,status:uiLifecycleContext?.lifecycleStatus('WORK_PACKAGE',child.id,'wp.lifecycle')??'UNKNOWN',progress:uiLifecycleContext?.lifecycleStatus('WORK_PACKAGE',child.id,'wp.progress')??'UNKNOWN'}))}));
</script>
<section class="milestone-progress-panel" data-testid="milestone-progress-panel">
  <div class="section-label"><span>Milestone Progress</span><small>{context.summary.complete} / {context.summary.workPackages} Work Packages</small></div>
  {#if workPackages.length===0}<p class="milestone-progress-empty">当前里程碑暂无 Work Package。</p>{:else}<div class="milestone-progress-list">{#each groupedWorkPackages as section}<section class="milestone-progress-group" data-roadmap-group={section.group.number}><h3>{section.group.number} — {section.group.title}</h3>{#if section.items.length===0}<p class="milestone-progress-group-empty">No Work Packages</p>{:else}{#each section.items as item}<div class="milestone-progress-row" class:selected={item.child.id===selectedWorkPackageId} role="button" tabindex="0" aria-pressed={item.child.id===selectedWorkPackageId} title={item.child.id} onclick={()=>onSelect(item.child.id)} onkeydown={(event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(item.child.id)}}}><span class="milestone-progress-dot">{#if item.status==='UNKNOWN'}<span aria-label="UNKNOWN">?</span>{:else}<StatusDot status={presentationStatus(item.status)} label={false}/>{/if}</span><span class="milestone-progress-content"><strong>{item.child.title}</strong><small>{item.child.phaseProgress?.currentPhaseTitle??(item.child.phaseProgress?'Phase plan available':'No phase plan')} · {item.status==='UNKNOWN'?'UNKNOWN':getStatusPresentationMeta(presentationStatus(item.status)).ownerLabel}</small></span><span class="milestone-progress-meter"><span class="milestone-progress-bar"><i style={`width:${item.progress==='UNKNOWN'?0:Math.max(0,Math.min(100,Number(item.progress)||0))}%`}></i></span><small>{item.child.phaseProgress?`${item.child.phaseProgress.completedCount} / ${item.child.phaseProgress.totalPhases} phases`:'No phase plan'}</small></span><button class="milestone-progress-arrow" aria-label={`打开 ${item.child.id} Work Package Workspace`} onclick={(event)=>{event.stopPropagation();onOpen(item.child.id)}}>→</button></div>{/each}{/if}</section>{/each}</div>{/if}
</section>
