<script lang="ts">
  export let title='';
  export let subtitle='';
  export let defaultExpanded=true;
  export let expanded:boolean|undefined=undefined;
  let open=expanded??defaultExpanded;
  const bodyId=`workspace-drawer-body-${Math.random().toString(36).slice(2)}`;
  $: if(expanded!==undefined&&expanded!==open)open=expanded;
  function toggle(){open=!open;if(expanded!==undefined)expanded=open}
</script>

<section class="workspace-drawer" data-testid="workspace-drawer">
  <header class="workspace-drawer-header">
    <div class="workspace-drawer-heading"><span class="workspace-drawer-title">{title}</span>{#if subtitle}<small>{subtitle}</small>{/if}</div>
    <div class="workspace-drawer-header-actions"><slot name="headerActions"/><button class="workspace-drawer-toggle" type="button" aria-expanded={open} aria-controls={bodyId} aria-label={`${open?'收起':'展开'}${title}`} onclick={toggle}>{open?'▲':'▼'}</button></div>
  </header>
  <div id={bodyId} class:workspace-drawer-body-collapsed={!open} class="workspace-drawer-body" aria-hidden={!open}><slot/></div>
</section>

<style>
  .workspace-drawer{min-width:0;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--surface);box-shadow:var(--shadow-panel);overflow:hidden}
  .workspace-drawer-header{display:flex;min-height:40px;align-items:center;justify-content:space-between;gap:12px;padding:0 var(--space-4);background:var(--surface)}
  .workspace-drawer-heading{display:flex;min-width:0;align-items:baseline;gap:8px}.workspace-drawer-title{min-width:0;overflow:hidden;color:var(--text-1);font-size:13px;font-weight:650;text-overflow:ellipsis;white-space:nowrap}.workspace-drawer-heading small{color:var(--text-3);font:10px var(--font-tech);white-space:nowrap}
  .workspace-drawer-header-actions{display:flex;flex:none;align-items:center;gap:8px}.workspace-drawer-toggle{width:28px;height:28px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--text-2);font:12px/1 var(--font-tech);cursor:pointer}.workspace-drawer-toggle:hover{background:var(--surface-soft);color:var(--text-1)}
  .workspace-drawer-body{min-width:0;padding:0 var(--space-4) var(--space-4)}.workspace-drawer-body-collapsed{display:none}
</style>
