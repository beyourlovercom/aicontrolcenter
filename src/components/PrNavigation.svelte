<script lang="ts">
  import {filterPrLayer2Records,type PrLayer2Record,type PrLifecycleStatus} from '../lib/prCanonicalProjection.ts';

  export let records:readonly PrLayer2Record[]=[];
  export let selectedId:string|null=null;
  export let onSelect:(id:string)=>void=()=>{};

  const filters:{id:'ALL'|PrLifecycleStatus|'UNMAPPED';label:string}[]=[
    {id:'ALL',label:'全部'}, {id:'IN_PROGRESS',label:'执行中'}, {id:'BLOCKED',label:'阻塞'}, {id:'COMPLETE',label:'完成'},
    {id:'UNMAPPED',label:'未绑定'}
  ];

  let filter:'ALL'|PrLifecycleStatus|'UNMAPPED'='ALL';
  $: visibleRecords=filterPrLayer2Records(records,filter);
</script>

<nav class="pr-navigation" aria-label="Pull request navigation" data-testid="pr-navigation">
  <div class="pr-filters" aria-label="PR status filters" data-testid="pr-navigation-filters">
    {#each filters as option}
      <button class:active={filter===option.id} aria-pressed={filter===option.id} data-testid={`pr-navigation-filter-${option.id.toLowerCase()}`} onclick={()=>filter=option.id}>{option.label}</button>
    {/each}
  </div>

  <div class="pr-list" data-testid="pr-navigation-list">
    {#each visibleRecords as record (record.identityKey)}
      <button class="pr-row" class:selected={selectedId===record.selectionId} aria-current={selectedId===record.selectionId?'true':undefined} data-testid={`pr-navigation-row-${record.selectionId}`} onclick={()=>onSelect(record.selectionId)}>
        <span class="pr-number">PR #{record.prNumber}</span>
        <span class="pr-title">{record.record.title??`PR #${record.prNumber}`}</span>
        <span class:in-progress={record.lifecycleStatus==='IN_PROGRESS'} class:blocked={record.lifecycleStatus==='BLOCKED'} class:complete={record.lifecycleStatus==='COMPLETE'} class="pr-status">{record.lifecycleStatus==='COMPLETE'?'☑ 完成':record.lifecycleStatus==='BLOCKED'?'● 阻塞':record.lifecycleStatus==='IN_PROGRESS'?'● 执行中':'? 未证明'}</span>
        <span class:mapped={record.mappingStatus==='MAPPED'} class="pr-mapping">{record.mappingStatus==='MAPPED'?'已绑定':'未绑定'}</span>
      </button>
    {:else}
      <p class="pr-empty" data-testid="pr-navigation-empty">No pull requests match this filter.</p>
    {/each}
  </div>
</nav>

<style>
  .pr-navigation{display:grid;gap:8px;min-width:0}.pr-filters{display:flex;flex-wrap:nowrap;gap:4px;overflow-x:auto;scrollbar-width:none}.pr-filters::-webkit-scrollbar{display:none}.pr-filters button{flex:0 0 auto;border:1px solid var(--border);border-radius:999px;background:var(--surface);color:var(--text-2);padding:4px 7px;font-size:11px;line-height:1.2;cursor:pointer}.pr-filters button.active{border-color:var(--accent);background:var(--surface-2);color:var(--accent)}.pr-list{display:grid;gap:3px;min-width:0}.pr-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;gap:6px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--text-1);padding:6px 7px;text-align:left;cursor:pointer;min-width:0}.pr-row:hover,.pr-row.selected{border-color:var(--accent);background:var(--surface-2)}.pr-number,.pr-status,.pr-mapping{font-size:11px;white-space:nowrap}.pr-number{font-weight:600}.pr-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.pr-status.in-progress{color:var(--warning,#a15c00)}.pr-status.blocked{color:var(--danger,#c04136)}.pr-status.complete{color:var(--success,#16803c)}.pr-mapping{color:var(--text-3)}.pr-mapping.mapped{color:var(--accent)}.pr-empty{margin:6px 0;color:var(--text-3);font-size:12px}
</style>
