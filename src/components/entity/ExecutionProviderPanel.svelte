<script lang="ts">
  import {DEFAULT_PROVIDER_DESCRIPTORS} from '../../lib/providerCatalog.ts';
  export let providerId='codex';
  export let status='RUNNING';
  export let executionType='IMPLEMENTATION';
  export let runnerReachable=true;
  export let editable=false;
  export let onProviderChange:(provider:'LOCAL_CODEX'|'REMOTE_CLAUDE')=>void=()=>{};
  $: active=DEFAULT_PROVIDER_DESCRIPTORS.find(item=>item.provider_id===(providerId==='LOCAL_CODEX'?'codex':providerId)||item.provider_id.toUpperCase()===providerId.toUpperCase())??DEFAULT_PROVIDER_DESCRIPTORS[0];
  $: capability=executionType==='READ_ONLY_AUDIT'?'Read only audit':executionType.charAt(0)+executionType.slice(1).toLowerCase();
</script>
<section class="provider-panel" data-testid="execution-provider-panel">
  <div class="provider-rows">
    <div class="provider-row"><span class="provider-label">Selected Provider</span>{#if editable}<select aria-label="Execution Provider" value={providerId==='REMOTE_CLAUDE'?'REMOTE_CLAUDE':'LOCAL_CODEX'} onchange={(event)=>onProviderChange((event.currentTarget as HTMLSelectElement).value as 'LOCAL_CODEX'|'REMOTE_CLAUDE')}><option value="LOCAL_CODEX">CN-Codex</option><option value="REMOTE_CLAUDE" disabled={!runnerReachable}>US-Claude</option></select>{:else}<b class="provider-value">{providerId==='REMOTE_CLAUDE'?'US-Claude':'CN-Codex'}</b>{/if}</div>
    <div class="provider-row"><span class="provider-label">Status</span><b class="provider-value">{status}</b></div>
    <div class="provider-row"><span class="provider-label">Capability</span><b class="provider-value">{capability}</b></div>
    <div class="provider-row"><span class="provider-label">Available Providers</span><span class="provider-value">{DEFAULT_PROVIDER_DESCRIPTORS.filter(item=>item.status==='active').map(item=>item.display_name).join(' · ')}</span></div>
    {#if providerId==='REMOTE_CLAUDE'}<div class="provider-row"><span class="provider-label">Runner</span><span class="provider-value" title={runnerReachable?'':'US-WAREHOUSE-01 unreachable'}>US-WAREHOUSE-01{runnerReachable?'':' · unreachable'}</span></div>{/if}
  </div>
</section>
<style>.provider-panel{display:grid;gap:10px;padding:12px;border:1px solid var(--border-soft);border-radius:8px;background:var(--surface)}.provider-rows{display:grid;gap:6px;margin:0}.provider-row{display:grid;grid-template-columns:max-content minmax(0,1fr);align-items:center;column-gap:12px;min-width:0}.provider-label{color:var(--text-3);text-align:left;white-space:nowrap;font-size:10px}.provider-value{min-width:0;overflow:hidden;color:var(--text-1);text-align:right;text-overflow:ellipsis;white-space:nowrap;font:11px var(--font-tech)}</style>
