<script lang="ts">
  import type {RoadmapNode,RoadmapPresentationGroup} from '../lib/workflow.ts';
  import {mapRoadmapStatusToVisualFamily,normalizeRoadmapProgress,roadmapEntityLabel,roadmapGroupKey,roadmapProgressLabel,roadmapStatusChineseLabel,type CollapsedNodeIds} from '../lib/roadmapUiBaseline.ts';

  export let nodes:RoadmapNode[]=[];
  export let selectedId='';
  export let collapsedNodeIds:CollapsedNodeIds=new Set();
  export let depth=1;
  export let roadmapGroups:readonly RoadmapPresentationGroup[]=[];
  export let groupParentId:string|undefined=undefined;
  export let onSelect:(node:RoadmapNode)=>void=()=>{};
  export let onToggle:(id:string,event?:Event)=>void=()=>{};

  const isExpanded=(node:RoadmapNode)=>!collapsedNodeIds.has(node.id);
  const visualFamily=(node:RoadmapNode)=>mapRoadmapStatusToVisualFamily(node.canonicalStatus??node.status);
  const exactStatus=(node:RoadmapNode)=>node.canonicalStatus??node.status;
  type DisplayEntry={kind:'entity';node:RoadmapNode}|{kind:'group';id:string;number:string;title:string;nodes:RoadmapNode[]};
  function displayEntries(items:RoadmapNode[]):DisplayEntry[]{
    if(depth!==2||!roadmapGroups.length)return items.map(node=>({kind:'entity',node}));
    const entries:DisplayEntry[]=[];
    const grouped=new Map(roadmapGroups.map(group=>[group.number,{kind:'group' as const,id:roadmapGroupKey(groupParentId??'ROADMAP',group.number),number:group.number,title:group.title,nodes:[]}]))
    for(const node of items){const group=node.roadmapGroupNumber?grouped.get(node.roadmapGroupNumber):undefined;if(group)group.nodes.push(node);else entries.push({kind:'entity',node});}
    for(const group of roadmapGroups){const entry=grouped.get(group.number);if(entry)entries.push(entry);}
    return entries;
  }
  const isExpandedGroup=(id:string)=>!collapsedNodeIds.has(id);
</script>

<div class="roadmap-tree" data-testid="roadmap-tree" data-depth={depth}>
  {#each displayEntries(nodes) as entry (entry.kind==='entity'?entry.node.id:entry.id)}
    {#if entry.kind==='group'}
      <section class="roadmap-subsection" data-roadmap-subsection={entry.number}>
        <div class="roadmap-subsection-row" style={`--roadmap-depth:${Math.min(depth,3)}`}>
          {#if entry.nodes.length}<button type="button" class="tree-toggle roadmap-subsection-toggle" class:expanded={isExpandedGroup(entry.id)} aria-label={`${isExpandedGroup(entry.id)?'折叠':'展开'} ${entry.number}`} aria-expanded={isExpandedGroup(entry.id)} onclick={(event)=>{event.stopPropagation();onToggle(entry.id,event)}}><span aria-hidden="true">{isExpandedGroup(entry.id)?'▾':'▸'}</span></button>{:else}<span class="tree-fold-slot"></span>{/if}
          <span class="roadmap-subsection-label">{entry.number} — {entry.title}</span>
        </div>
        {#if isExpandedGroup(entry.id)}
          <div class="roadmap-subsection-children"><svelte:self nodes={entry.nodes} {selectedId} {collapsedNodeIds} depth={depth} roadmapGroups={[]} onSelect={(node)=>onSelect(node)} onToggle={(id,event)=>onToggle(id,event)}/></div>
        {/if}
      </section>
    {:else}
      {@const node=entry.node}
      <div class="tree-node" data-roadmap-node={node.id} data-roadmap-type={node.type} data-roadmap-depth={depth}>
      <div class="tree-row" class:current={node.id===selectedId} style={`--roadmap-depth:${Math.min(depth,3)}`}>
        <span class="tree-fold-slot">
          {#if node.children.length}
            <button type="button" class="tree-toggle" class:expanded={isExpanded(node)} aria-label={`${isExpanded(node)?'折叠':'展开'} ${node.id}`} aria-expanded={isExpanded(node)} onclick={(event)=>{event.stopPropagation();onToggle(node.id,event)}}>
              <span aria-hidden="true">{isExpanded(node)?'▾':'▸'}</span>
            </button>
          {/if}
        </span>
        <button class="tree-select" title={roadmapEntityLabel(node)} onclick={()=>onSelect(node)}>{roadmapEntityLabel(node)}</button>
        <span class="tree-progress" data-testid="roadmap-progress-column">{roadmapProgressLabel(node.progress)}</span>
        <button type="button" class="tree-status-wrap" data-testid="roadmap-status-column" aria-label={`${roadmapStatusChineseLabel(exactStatus(node))}，${exactStatus(node)}，进度 ${roadmapProgressLabel(node.progress)}`}>
          <span class="tree-status-icon" class:blocked={visualFamily(node)==='BLOCKED'} class:active={visualFamily(node)==='ACTIVE'} class:complete={visualFamily(node)==='COMPLETE'} data-visual-family={visualFamily(node)} aria-hidden="true">{visualFamily(node)==='COMPLETE'?'✓':''}</span>
          <span class="roadmap-status-tooltip" role="tooltip">
            <strong>{roadmapStatusChineseLabel(exactStatus(node))}</strong>
            <span>{exactStatus(node)}</span>
            <span>进度 {normalizeRoadmapProgress(node.progress)===null?'—':`${node.progress}%`}</span>
          </span>
        </button>
      </div>
      {#if node.children.length&&!collapsedNodeIds.has(node.id)&&depth<3}
        <div class="tree-children" data-parent={node.id}>
          <svelte:self nodes={node.children} {selectedId} {collapsedNodeIds} depth={depth+1} roadmapGroups={node.roadmapGroups??[]} groupParentId={node.id} onSelect={(node)=>onSelect(node)} onToggle={(id,event)=>onToggle(id,event)}/>
        </div>
      {/if}
    </div>
    {/if}
  {/each}
</div>
