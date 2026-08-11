<script lang="ts">
  import StatusDot from '../StatusDot.svelte';
  import {getStatusPresentationMeta} from '../../lib/statusPresentation';
  import type {ResolvedEntityContext} from '../../lib/model/entityTypes';
  export let context:ResolvedEntityContext;
  export let description=context.title;
  export let onSave:(value:string)=>Promise<void>=async()=>{};
  let editing=false,draft='';
  $: typeLabel=context.type==='milestone'?'MILESTONE':context.type==='work_package'?'WP':'PR';
  $: statusMeta=getStatusPresentationMeta(context.status);
  $: parent=context.type==='work_package'?context.parentMilestone?.title:context.type==='pull_request'?context.parentWorkPackageId:null;
</script>
<section class="hero entity-header-standard" data-testid="entity-header" data-entity-type={context.type}>
  <div class="entity-header-row entity-header-row-one"><span class="entity-breadcrumb">{context.breadcrumb}</span><span class="entity-kind">[{typeLabel}]</span></div>
  <div class="entity-header-row entity-header-row-two"><h1>{context.displayTitle}</h1>{#if editing}<div class="entity-description-editor"><textarea bind:value={draft} aria-label="当前描述"></textarea><button onclick={async()=>{await onSave(draft);editing=false}}>保存</button><button onclick={()=>editing=false}>取消</button><button class="restore" onclick={async()=>{await onSave('');editing=false}}>恢复默认描述</button></div>{:else}<button class="entity-description-edit" onclick={()=>{draft=description;editing=true}}>✎ 编辑描述</button>{/if}</div>
  <div class="entity-header-row entity-header-row-three"><p class="entity-meta">{description}{#if parent}<span aria-hidden="true"> · </span>{parent}{/if}</p><p class="entity-status" aria-label={context.statusLabel} data-domain-status={context.statusLabel}><StatusDot status={context.status} label={false}/><span>{statusMeta.ownerLabel}</span></p></div>
</section>
