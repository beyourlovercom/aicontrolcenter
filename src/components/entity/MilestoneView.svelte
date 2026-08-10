<script lang="ts">import type {MilestoneEntityContext} from '../../lib/model/entityTypes';export let context:MilestoneEntityContext;</script>
<section class="milestone-view" data-testid="milestone-view">
  <div class="milestone-badge">[MILESTONE OVERVIEW]</div>
  <h2>{context.title}</h2><p>状态：{context.statusLabel} · 进度：{context.progress??0}%</p>
  <div class="milestone-card">
    <strong>Goal</strong><p>{context.goal}</p>
    <strong>Dependencies</strong><p>{context.dependencies}</p>
    <strong>Work Packages</strong><p>共 {context.summary.workPackages} · 完成 {context.summary.complete} · 等待/进行中 {context.summary.waiting} · 阻塞 {context.summary.blocked}</p><strong>Pull Requests</strong><p>真实 PR：{context.summary.pullRequests} · DEMO PR：{context.children.flatMap(child=>child.children).filter(child=>child.type==='pull_request').length}</p>
    <strong>Blockers</strong><p>{context.blockers.length?context.blockers.join('；'):'当前无已记录阻塞。'}</p>
    <strong>Next Action</strong><p>{context.nextAction}</p>
  </div>
</section>
