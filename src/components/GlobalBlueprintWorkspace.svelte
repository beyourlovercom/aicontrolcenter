<script lang="ts">
  export let milestones:any[]=[];
  export let workPackages:any[]=[];
  export let pullRequests:any[]=[];
  export let tasks:any[]=[];
  export let currentMilestone:string='—';
  export let currentWorkPackage:string='—';
  export let currentPhase:string='—';
  export let ownerWaiting=0;
</script>

<section class="global-summary-workspace global-blueprint-workspace" data-testid="global-blueprint-workspace">
  <div class="section-label"><span>Global Blueprint</span><small>Roadmap summary</small></div>
  <div class="global-summary-grid" data-testid="blueprint-summary-metrics">
    <div><strong>{milestones.length}</strong><span>Milestones</span></div><div><strong>{workPackages.length}</strong><span>Work Packages</span></div>
    <div><strong>{pullRequests.length}</strong><span>PRs</span></div><div><strong>{tasks.length}</strong><span>Tasks</span></div><div><strong>{ownerWaiting}</strong><span>Owner Waiting</span></div>
  </div>
  <section class="global-summary-section"><div class="section-label"><span>Current Focus</span><small>canonical projection</small></div><div class="global-focus-grid"><div><span>Milestone</span><strong>{currentMilestone}</strong></div><div><span>Work Package</span><strong>{currentWorkPackage}</strong></div><div><span>Phase</span><strong>{currentPhase}</strong></div></div></section>
  <section class="global-summary-section"><div class="section-label"><span>Milestone Progress</span><small>{milestones.length} milestones</small></div><div class="global-milestone-list">{#each milestones as milestone}<div class="global-milestone-row"><div><strong>{milestone.id}</strong><span>{milestone.title}</span></div><div class="global-progress"><b>{milestone.progress??0}%</b><small>{(milestone.children??[]).filter((node:any)=>node.type==='work_package').length} WP</small></div></div>{:else}<p class="global-empty">暂无 Roadmap 数据。</p>{/each}</div></section>
  <section class="global-summary-section"><div class="section-label"><span>Recent Project Activity</span><small>read-only</small></div><p class="global-activity">{workPackages.length?`已加载 ${workPackages.length} 个正式 Work Package`:'暂无近期项目活动'} · {pullRequests.length} 个 PR · {tasks.length} 个 Task</p></section>
</section>
