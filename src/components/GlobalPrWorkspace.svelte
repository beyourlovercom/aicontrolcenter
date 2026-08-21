<script lang="ts">
  import type {PrLayer2Record} from '../lib/prCanonicalProjection.ts';
  export let records:readonly PrLayer2Record[]=[];
  export let selectedId:string|null=null;
  export let onSelect:(id:string)=>void=()=>{};
  let filter:'ALL'|'OPEN'|'DRAFT'|'MERGED'|'CLOSED'|'UNMAPPED'='ALL';
  $: filtered=[...records].filter(record=>filter==='ALL'||filter==='UNMAPPED'?filter==='ALL'||record.mappingStatus==='UNMAPPED':record.presentationLifecycle===filter).sort((a,b)=>a.prNumber-b.prNumber);
  const stateLabel=(record:PrLayer2Record)=>record.presentationLifecycle==='UNKNOWN'?'Unknown':record.presentationLifecycle[0]+record.presentationLifecycle.slice(1).toLowerCase();
</script>

<section class="global-pr-workspace" data-testid="global-pr-workspace">
  <div class="section-label"><span>全局 PR#</span><small>Repository PR history · {records.length}</small></div>
  <div class="global-pr-filters" role="tablist" aria-label="PR 筛选"><button class:active={filter==='ALL'} onclick={()=>filter='ALL'}>All</button><button class:active={filter==='OPEN'} onclick={()=>filter='OPEN'}>Open</button><button class:active={filter==='DRAFT'} onclick={()=>filter='DRAFT'}>Draft</button><button class:active={filter==='MERGED'} onclick={()=>filter='MERGED'}>Merged</button><button class:active={filter==='CLOSED'} onclick={()=>filter='CLOSED'}>Closed</button><button class:active={filter==='UNMAPPED'} onclick={()=>filter='UNMAPPED'}>Unmapped · 未绑定</button></div>
  <div class="global-pr-list">{#each filtered as record}<button class="global-pr-row" class:selected={selectedId===record.selectionId} aria-current={selectedId===record.selectionId?'true':undefined} data-testid={`global-pr-${record.prNumber}`} onclick={()=>onSelect(record.selectionId)}><strong>PR #{record.prNumber}</strong><span>{stateLabel(record)}</span><span>{record.parentWpId??'未绑定'}</span><span>{record.record.deliveryBranch??record.record.sourceBranch??'branch unavailable'}</span><code>{(record.record.deliveryHeadSha??record.record.headSha??'').slice(0,8)||'—'}</code></button>{:else}<p class="global-pr-empty">暂无符合条件的仓库 PR。</p>{/each}</div>
</section>
<style>
  .global-pr-workspace{display:grid;gap:14px}.global-pr-filters{display:flex;flex-wrap:wrap;gap:6px}.global-pr-filters button{border:1px solid var(--border);border-radius:999px;background:var(--surface);color:var(--text-2);padding:5px 9px;font-size:11px;cursor:pointer}.global-pr-filters button.active{border-color:var(--accent);color:var(--accent);background:var(--surface-2)}.global-pr-list{display:grid;gap:4px}.global-pr-row{display:grid;grid-template-columns:72px 72px minmax(180px,1fr) minmax(160px,1fr) 70px;align-items:center;gap:10px;border:1px solid var(--border-soft);border-radius:8px;background:var(--surface);color:var(--text-1);padding:9px 10px;text-align:left;cursor:pointer}.global-pr-row:hover,.global-pr-row.selected{border-color:var(--accent);background:var(--surface-2)}.global-pr-row span,.global-pr-row code{font-size:11px;color:var(--text-2)}.global-pr-empty{color:var(--text-3)}
</style>
