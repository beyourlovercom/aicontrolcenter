<script lang="ts">
  import StatusDot from './StatusDot.svelte';
  import type {RoadmapNode} from '../lib/workflow';
  export let nodes:RoadmapNode[]=[];export let selectedId='';export let onSelect:(id:string)=>void=()=>{};
  let open:Record<string,boolean>={};const key='aicc-v2-roadmap-collapse';
  try{open=JSON.parse(localStorage.getItem(key)||'{}')}catch{}
  function toggle(id:string){open={...open,[id]:open[id]===false};localStorage.setItem(key,JSON.stringify(open))}
</script>
<div class="roadmap-tree" data-testid="roadmap-tree">{#each nodes as node}<div class="tree-node" data-roadmap-node={node.id}>
  <div class:current={node.id===selectedId} class="tree-row">
    {#if node.children.length}<button class="tree-toggle" aria-label={`${open[node.id]!==false?'折叠':'展开'} ${node.id}`} aria-expanded={open[node.id]!==false} onclick={(event)=>{event.stopPropagation();toggle(node.id)}}>{open[node.id]!==false?'▾':'▸'}</button>{:else}<span class="tree-toggle-empty" aria-hidden="true"></span>{/if}<span class="outline-marker" aria-hidden="true"></span>
    <button class="tree-select" title={node.title} onclick={()=>onSelect(node.id)}><strong>{node.title}</strong><span class="tree-meta">{node.progress===null?'—':`${node.progress}%`} <StatusDot status={node.status} label={false}/></span></button>
  </div>
  {#if node.children.length&&open[node.id]!==false}<div class="tree-children" data-parent={node.id}><svelte:self nodes={node.children} {selectedId} {onSelect}/></div>{/if}
</div>{/each}</div>
