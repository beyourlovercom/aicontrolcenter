<script lang="ts">
  import type {PullRequestRecord,SelectedEntityRef} from '../lib/model/entityTypes.ts';
  export let records:PullRequestRecord[]=[];
  export let onSelect:(entity:SelectedEntityRef)=>void=()=>{};
  let filter:'ALL'|'OPEN'|'DRAFT'|'MERGED'|'CLOSED'|'UNMAPPED'='ALL';
  $: filtered=[...records].filter(record=>{if(filter==='ALL')return true;if(filter==='UNMAPPED')return !record.workPackageId;if(filter==='OPEN')return record.state==='OPEN';if(filter==='DRAFT')return record.draft===true; if(filter==='MERGED')return record.state==='MERGED';return record.state==='CLOSED';}).sort((a,b)=>(a.number??0)-(b.number??0));
  const stateLabel=(record:PullRequestRecord)=>record.draft?'Draft':record.state==='MERGED'?'Merged':record.state==='CLOSED'?'Closed':record.state==='OPEN'?'Open':'Unknown';
</script>

<section class="global-pr-workspace" data-testid="global-pr-workspace">
  <div class="section-label"><span>全局 PR#</span><small>Repository PR history · {records.length}</small></div>
  <div class="global-pr-filters" role="tablist" aria-label="PR 筛选"><button class:active={filter==='ALL'} onclick={()=>filter='ALL'}>All</button><button class:active={filter==='OPEN'} onclick={()=>filter='OPEN'}>Open</button><button class:active={filter==='DRAFT'} onclick={()=>filter='DRAFT'}>Draft</button><button class:active={filter==='MERGED'} onclick={()=>filter='MERGED'}>Merged</button><button class:active={filter==='CLOSED'} onclick={()=>filter='CLOSED'}>Closed</button><button class:active={filter==='UNMAPPED'} onclick={()=>filter='UNMAPPED'}>Unmapped · 未绑定</button></div>
  <div class="global-pr-list">{#each filtered as record}<button class="global-pr-row" data-testid={`global-pr-${record.number??record.id}`} onclick={()=>onSelect({type:'pull_request',id:record.id})}><strong>PR #{record.number??'?'}</strong><span>{stateLabel(record)}</span><span>{record.workPackageId??'未绑定'}</span><span>{record.deliveryBranch??record.sourceBranch??'branch unavailable'}</span><code>{(record.deliveryHeadSha??record.headSha??'').slice(0,8)||'—'}</code></button>{:else}<p class="global-pr-empty">暂无符合条件的仓库 PR。</p>{/each}</div>
</section>
<style>
  .global-pr-workspace{display:grid;gap:14px}.global-pr-filters{display:flex;flex-wrap:wrap;gap:6px}.global-pr-filters button{border:1px solid var(--border);border-radius:999px;background:var(--surface);color:var(--text-2);padding:5px 9px;font-size:11px;cursor:pointer}.global-pr-filters button.active{border-color:var(--accent);color:var(--accent);background:var(--surface-2)}.global-pr-list{display:grid;gap:4px}.global-pr-row{display:grid;grid-template-columns:72px 72px minmax(180px,1fr) minmax(160px,1fr) 70px;align-items:center;gap:10px;border:1px solid var(--border-soft);border-radius:8px;background:var(--surface);color:var(--text-1);padding:9px 10px;text-align:left;cursor:pointer}.global-pr-row:hover{border-color:var(--accent)}.global-pr-row span,.global-pr-row code{font-size:11px;color:var(--text-2)}.global-pr-empty{color:var(--text-3)}
</style>
