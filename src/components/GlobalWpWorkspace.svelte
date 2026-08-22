<script lang="ts">
  import type {SelectedEntityRef} from '../lib/model/entityTypes.ts';
  import GlobalTaskActionBar from './GlobalTaskActionBar.svelte';
  import SchedulerPanel from './entity/SchedulerPanel.svelte';
  import SchedulerStatusProjection from './SchedulerStatusProjection.svelte';
  import WpGeneratorPanel from './WpGeneratorPanel.svelte';
  import ProjectContextPanel from './ProjectContextPanel.svelte';
  import {createProjectRegistryAuthority} from '../lib/projectRegistryAuthority.ts';
  import WorkPackageDetailView from './entity/WorkPackageDetailView.svelte';
  import CreateWorkPackageModal from './CreateWorkPackageModal.svelte';
  import {createWorkPackage,type CreateWorkPackageRequest,type CreatedWorkPackage} from '../lib/workPackageCreationRuntime.ts';
  import DeliveryEvidencePanel from './DeliveryEvidencePanel.svelte';
  import CodexExecutionPanel from './CodexExecutionPanel.svelte';
  import ProjectOverviewPanel from './ProjectOverviewPanel.svelte';
  import GlobalWorkspaceSelector from './GlobalWorkspaceSelector.svelte';
  import DependencyPanel from './DependencyPanel.svelte';
  import IssueIntelligencePanel from './IssueIntelligencePanel.svelte';
  import AutonomousProposalPanel from './AutonomousProposalPanel.svelte';
  import RemediationPanel from './RemediationPanel.svelte';
  import ContinuousDeliveryDashboard from './ContinuousDeliveryDashboard.svelte';
  import SelfDevelopmentPanel from './SelfDevelopmentPanel.svelte';
  import SelfOptimizationPanel from './SelfOptimizationPanel.svelte';
  import AgentOrchestrationPanel from './AgentOrchestrationPanel.svelte';
  import KnowledgeGraphPanel from './KnowledgeGraphPanel.svelte';
  export let records:any[]=[];
  export let nodes:any[]=[];
  export let selectedId:string|null=null;
  export let onSelect:(entity:SelectedEntityRef)=>void=()=>{};
  export let onRefresh:()=>void=()=>{};
  let filter='ALL';
  const projectAuthority=createProjectRegistryAuthority();
  $: activeProject=projectAuthority.getActiveProject();
  let selectedRecord:any=null;
  let createOpen=false;let autoCreateOpen=false;let created:CreatedWorkPackage[]=[];
  function create(request:CreateWorkPackageRequest){const values=new Map<string,CreatedWorkPackage>(created.map(item=>[item.id,item]));const item=createWorkPackage(request,{get:id=>values.get(id)??null,put:value=>values.set(value.id,value)},wp=>({delivery_context_id:`delivery-${wp.id}`,execution_context_id:null}));created=[...created.filter(value=>value.id!==item.id),item];createOpen=false;}
  $: filtered=records.filter((record:any)=>filter==='ALL'||String(record.status??'').toUpperCase()===filter);
  // Selection is projected from App.svelte's canonical selectedEntity. This
  // component owns no concrete WP selection state of its own.
  $: selectedRecord=records.find((record:any)=>record.id===selectedId)??null;
</script>

<section class="global-summary-workspace global-wp-workspace" data-testid="global-wp-workspace">
  <div class="section-label"><span>Global Work Packages</span><small>WP management · {records.length}</small><GlobalTaskActionBar onAutoCreateWorkPackage={()=>autoCreateOpen=true} onManualCreateWorkPackage={()=>createOpen=true} {onRefresh}/></div>
  <ProjectContextPanel projects={[activeProject] as any}/><GlobalWorkspaceSelector workspace={selectedRecord}/><SelfDevelopmentPanel/><SelfOptimizationPanel/><AgentOrchestrationPanel/><KnowledgeGraphPanel/><ContinuousDeliveryDashboard projects={1} activeWp={records.length} running={records.filter((r:any)=>r.executionState==='RUNNING').length} risk={records.filter((r:any)=>r.risk==='HIGH'||r.risk==='CRITICAL').length} blocked={records.filter((r:any)=>r.status==='BLOCKED').length}/><ProjectOverviewPanel project={null}/><DependencyPanel/><IssueIntelligencePanel issues={records.flatMap((record:any)=>record.issueIntelligence??[])}/><AutonomousProposalPanel proposal={null}/><RemediationPanel remediation={null}/><CodexExecutionPanel execution={selectedRecord}/><DeliveryEvidencePanel evidence={records.flatMap((record:any)=>record.evidence??[])}/>
  <div class="global-summary-grid global-wp-counters"><div><strong>{records.length}</strong><span>All</span></div><div><strong>{records.filter((r:any)=>r.status==='IN_PROGRESS').length}</strong><span>Active</span></div><div><strong>{records.filter((r:any)=>r.status==='BLOCKED').length}</strong><span>Blocked</span></div><div><strong>{records.filter((r:any)=>r.status==='COMPLETE'||r.status==='CLOSED').length}</strong><span>Completed</span></div><div><strong>{records.filter((r:any)=>!r.workPackageId).length}</strong><span>Unmapped</span></div></div>
  <div class="global-wp-filters" role="tablist" aria-label="Work Package 筛选"><button class:active={filter==='ALL'} onclick={()=>filter='ALL'}>All</button><button class:active={filter==='IN_PROGRESS'} onclick={()=>filter='IN_PROGRESS'}>Active</button><button class:active={filter==='BLOCKED'} onclick={()=>filter='BLOCKED'}>Blocked</button><button class:active={filter==='COMPLETE'} onclick={()=>filter='COMPLETE'}>Completed</button></div>
  <div class="global-wp-list" data-testid="global-wp-list"><div class="source-banner">Source: GitHub · Lifecycle projection: AICC · Evidence: Available when discovered</div>{#each filtered as record}<button class:selected={selectedId===record.id} class="global-wp-row" onclick={()=>onSelect({type:'work_package',id:record.id})}><strong>{record.id}</strong><span>{record.title}</span><span>{record.source??record.origin??'GITHUB'}</span><span>{record.milestoneId??'—'}</span><span>{record.phase??'—'}</span><b>{record.status??'UNKNOWN'}</b><span>{record.provider??'codex'}</span><span>{record.executionState??'NOT_STARTED'}</span><span>{record.deliveryState??'NOT_AVAILABLE'}</span></button>{:else}<p class="global-empty">暂无符合条件的 Work Package。</p>{/each}</div>
  {#if created.length}<section class="prepared-wp-list" data-testid="prepared-wp-list"><div class="section-label"><span>Prepared Work Packages</span><small>Not canonical · awaiting Roadmap admission</small></div>{#each created as record}<div class="global-wp-row prepared-wp-row" data-testid="prepared-wp-row"><strong>{record.id}</strong><span>{record.title}</span><span>{record.origin}</span><span>{record.milestone??'—'}</span><span>{record.phase??'—'}</span><b>PREPARED</b><span>{record.provider}</span><span>NOT_CANONICAL</span><span>AWAITING_ROADMAP</span></div>{/each}</section>{/if}<SchedulerStatusProjection queue={[]}/>{#if selectedRecord}<WorkPackageDetailView record={selectedRecord}/><SchedulerPanel queue={[]} slots={[]}/>{/if}
</section>
<CreateWorkPackageModal open={createOpen} onClose={()=>createOpen=false} onCreate={create}/>
  {#if autoCreateOpen}<div class="auto-create-overlay" role="presentation" data-testid="auto-create-wp-overlay"><div class="auto-create-placeholder" role="dialog" aria-modal="true" aria-labelledby="auto-create-wp-title" data-testid="auto-create-wp-placeholder"><div class="auto-create-header"><strong id="auto-create-wp-title">AICC AI 建议 WP</strong><button class="service-action" aria-label="关闭 AI 建议 WP" onclick={()=>autoCreateOpen=false}>关闭</button></div><WpGeneratorPanel onExport={()=>autoCreateOpen=false}/></div></div>{/if}
<style>.auto-create-overlay{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.42)}.auto-create-placeholder{width:min(680px,calc(100vw - 40px));max-height:calc(100vh - 40px);overflow:auto;padding:14px;border:1px solid var(--border);border-radius:10px;background:var(--surface);box-shadow:var(--shadow-panel)}.auto-create-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}</style>
