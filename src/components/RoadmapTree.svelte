<script lang="ts">
  import StatusDot from './StatusDot.svelte';
  import type {RoadmapNode} from '../lib/workflow';
  export let nodes:RoadmapNode[]=[];export let selectedId='';export let onSelect:(id:string)=>void=()=>{};
  let open:Record<string,boolean>={};const key='aicc-v2-roadmap-collapse';
  try{open=JSON.parse(localStorage.getItem(key)||'{}')}catch{}
  function toggle(id:string){open={...open,[id]:open[id]===false};localStorage.setItem(key,JSON.stringify(open))}
</script>
<div class="roadmap-tree" data-testid="roadmap-tree">{#each nodes as node}<div class="tree-node">
  <div class:current={node.id===selectedId} class="tree-row">
    <button class="tree-toggle" aria-label={`${open[node.id]!==false?'折叠':'展开'} ${node.id}`} aria-expanded={node.children.length?open[node.id]!==false:undefined} onclick={()=>node.children.length&&toggle(node.id)}>{node.children.length?(open[node.id]!==false?'▾':'▸'):'·'}</button>
    <button class="tree-select" onclick={()=>onSelect(node.id)}><span class="tree-type">{node.type==='milestone'?'M':node.type==='work_package'?'WP':'PR'}</span><StatusDot status={node.status}/><strong>{node.title}</strong>{#if node.type==='pull_request'}<small>DEMO · LOCAL FIXTURE</small>{:else if node.progress!==null}<small>{node.progress}%</small>{/if}</button>
  </div>
  {#if node.children.length&&open[node.id]!==false}<div class="tree-children" data-parent={node.id}><svelte:self nodes={node.children} {selectedId} {onSelect}/></div>{/if}
</div>{/each}</div>
