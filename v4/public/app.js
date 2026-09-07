const state = {
  projects: [],
  viewProjectId: localStorage.getItem('aicc.v4.viewProjectId') || 'all',
  selectedNode: null,
  freshness: {},
  attentionMode: false,
  runtimeMode: false,
  runtime: { available: false, observationState: 'UNAVAILABLE', machines: [] },
  loading: true,
  error: null
};

const main = document.querySelector('#main');
const statusbar = document.querySelector('#statusbar');
const switcher = document.querySelector('#switcher');
const switcherButton = document.querySelector('#switcherButton');
const switcherLabel = document.querySelector('#switcherLabel');
const switcherMenu = document.querySelector('#switcherMenu');
const refreshButton = document.querySelector('#refreshButton');
const contextButton = document.querySelector('#contextButton');
const attentionButton = document.querySelector('#attentionButton');
const attentionCount = document.querySelector('#attentionCount');
const runtimeButton = document.querySelector('#runtimeButton');
const runtimeCount = document.querySelector('#runtimeCount');

const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const shortSha = (sha) => sha ? sha.slice(0, 10) : '—';
const projectById = (id) => state.projects.find((project) => project.projectId === id);
const treeStorageKey = (projectId) => `aicc.v4.treeState.${projectId}`;
let refreshEpoch = 0;

function ciSummary(ci) {
  if (!ci) return '暂无 CI 数据';
  const total = Number(ci.total || 0);
  if (!total) return 'main 暂无检查';
  const success = Number(ci.byConclusion?.success || 0);
  const failure = Number(ci.byConclusion?.failure || 0);
  const pending = Number(ci.byStatus?.in_progress || 0) + Number(ci.byStatus?.queued || 0);
  return `${total} 项检查 · ${success} 成功${failure ? ` · ${failure} 失败` : ''}${pending ? ` · ${pending} 运行中` : ''}`;
}

function freshness(project) {
  return project?.provenance?.ref ? `GitHub main@${shortSha(project.provenance.ref)}` : 'GitHub 事实不可用';
}

function progressLabel(progress) {
  return progress?.available ? `${progress.percentage}%` : '—';
}

function progressEvidence(progress) {
  if (!progress?.available) return '暂无 GitHub 进度证据';
  if (progress.basis === 'explicit-percent') return `GitHub 明确进度标记${progress.line ? ` · 第 ${progress.line} 行` : ''}`;
  return `${progress.completed}/${progress.total} 个 GitHub Markdown 检查项`;
}

function projectionStatus(project) {
  if (!project?.available) return 'UNKNOWN';
  if (project.provenance?.repository !== project.repository || project.provenance?.ref !== project.mainSha) return 'DRIFT';
  return state.freshness[project.projectId]?.status || 'FRESH';
}

function projectionStatusLabel(status) {
  return ({ FRESH:'最新', STALE:'已过期', DRIFT:'已漂移', UNKNOWN:'未知' })[status] || status || '未知';
}

function runtimeObservationLabel(status) {
  return ({ FRESH_OBSERVATION:'观测最新', STALE_OBSERVATION:'观测已过期', UNAVAILABLE:'不可用' })[status] || status || '不可用';
}

function machineRoleLabel(role) {
  return ({ 'Primary Development':'主开发机', 'Verification':'验证机', 'Development / Andy-Core':'开发机 / Andy-Core' })[role] || role || '未设置角色';
}

function projectionBadge(project) {
  const status = projectionStatus(project);
  return `<span class="projection-pill ${status.toLowerCase()}">${esc(projectionStatusLabel(status))}</span>`;
}

function clientSuggestedNext(project) {
  const projection = projectionStatus(project);
  if (projection !== 'FRESH') return { kind:'GITHUB_RECONCILIATION', text:'操作前先刷新并对账 GitHub。', reason:`当前 AICC 数据状态为“${projectionStatusLabel(projection)}”；GitHub 仍是唯一权威事实源。`, evidence:`${project.repository}@${shortSha(project.mainSha)}` };
  const gate = project.ownerAttention?.[0];
  if (gate) return { kind:'OWNER_GATE_RECONCILIATION', text:`对账明确待我处理事项：${gate.title}`, reason:'GitHub 已明确标记需要负责人处理；操作前必须核对精确证据。', evidence:gate.source === 'pull-request' ? `GitHub PR #${gate.prNumber}` : `${project.roadmap?.path || '路线图'} · 第 ${gate.line || '—'} 行` };
  const task = project.roadmap?.currentPointers?.task;
  if (task?.value) return { kind:'CURRENT_TASK_RECONCILIATION', text:`对账当前明确任务：${task.value}`, reason:'GitHub 路线图存在明确“当前任务”标记；GPT 在仓库与运行状态对账后决定是否执行。', evidence:`${project.roadmap.path} · 第 ${task.line} 行` };
  const wp = project.roadmap?.currentPointers?.workPackage;
  if (wp?.value) return { kind:'CURRENT_WP_RECONCILIATION', text:`对账当前工作包：${wp.value}`, reason:'GitHub 路线图存在明确“当前工作包”标记，但没有明确“当前任务”标记。', evidence:`${project.roadmap.path} · 第 ${wp.line} 行` };
  const prs = [...(project.openPullRequests || [])].sort((a,b) => (Date.parse(b.updatedAt || '') || 0) - (Date.parse(a.updatedAt || '') || 0) || Number(b.number || 0) - Number(a.number || 0));
  if (prs.length) return { kind:'OPEN_PR_RECONCILIATION', text:`检查待处理 PR #${prs[0].number}：${prs[0].title}`, reason:'当前没有明确任务或工作包；继续、修改或合并前，先在 GitHub 对账 PR 源分支、审核状态和 CI。', evidence:`GitHub PR #${prs[0].number} · 源分支 ${shortSha(prs[0].headSha)}` };
  if (project.roadmap?.path) return { kind:'ROADMAP_REVIEW', text:'检查 GitHub 路线图，确认下一项明确任务。', reason:'当前没有更明确的审批待办、当前任务、当前工作包或 PR 证据。', evidence:project.roadmap.path };
  return { kind:'GITHUB_RECONCILIATION', text:'选择下一项开发动作前，先直接检查 GitHub。', reason:'AICC 当前没有更明确的证据。', evidence:project.repository };
}

function allOwnerAttention() {
  return state.projects.flatMap((project) => (project.ownerAttention || []).map((item) => ({ ...item, projectId: project.projectId, projectName: project.name, repository: project.repository })));
}

function attentionTypeLabel(type) {
  return ({ HUMAN_UAT:'人工验收', MERGE_APPROVAL:'合并审批', DEPLOY_APPROVAL:'部署审批', PRODUCTION_GATE:'生产门禁', OWNER_DECISION:'负责人决策', OWNER_ACTION:'负责人操作' })[type] || type || '负责人操作';
}

function renderAttentionButton() {
  const count = allOwnerAttention().length;
  attentionCount.textContent = String(count);
  attentionButton.classList.toggle('has-attention', count > 0);
  attentionButton.title = count ? `${count} 项 GitHub 明确待我处理事项` : '当前没有 GitHub 明确待我处理事项';
}

function runtimeStatusClass(status) {
  return ({ ONLINE:'online', OFFLINE:'offline', STALE_OBSERVATION:'stale', UNOBSERVED:'unknown', UNKNOWN:'unknown' })[status] || 'unknown';
}

function runtimeStatusLabel(machine) {
  if (machine.status === 'STALE_OBSERVATION') return `观测已过期 · 上次${machine.reportedStatus === 'ONLINE' ? '在线' : machine.reportedStatus === 'OFFLINE' ? '离线' : '未知'}`;
  return ({ ONLINE:'在线', OFFLINE:'离线', UNOBSERVED:'未观测', UNKNOWN:'未知' })[machine.status] || machine.status || '未观测';
}

function runtimeDevicesForProject(projectId) {
  return (state.runtime?.machines || []).filter((machine) => (machine.projectIds || []).includes(projectId));
}

function renderRuntimeButton() {
  const machines = state.runtime?.machines || [];
  const online = machines.filter((machine) => machine.status === 'ONLINE').length;
  runtimeCount.textContent = `${online}/${machines.length || 3}`;
  runtimeButton.classList.toggle('runtime-stale', state.runtime?.observationState === 'STALE_OBSERVATION');
  runtimeButton.title = state.runtime?.available ? `${runtimeObservationLabel(state.runtime.observationState)} · 最新 DC 观测 ${online}/${machines.length} 台在线` : '暂无 DC 运行观测';
}

function renderContextButton() {
  const project = state.viewProjectId === 'all' ? null : projectById(state.viewProjectId);
  contextButton.disabled = state.loading || !project?.available || state.attentionMode || state.runtimeMode;
  contextButton.title = project?.available ? `复制 ${project.name} 的最新 GitHub 驱动 GPT 上下文` : '请先选择一个可用项目';
}

async function writeClipboard(text) {
  if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return; }
  const area = document.createElement('textarea');
  area.value = text; area.setAttribute('readonly',''); area.style.position = 'fixed'; area.style.opacity = '0';
  document.body.appendChild(area); area.select();
  const ok = document.execCommand('copy'); area.remove();
  if (!ok) throw new Error('剪贴板不可用');
}

async function copyProjectContext(projectId, button = contextButton) {
  const project = projectById(projectId);
  if (!project?.available) return;
  const original = button.textContent;
  button.disabled = true; button.textContent = '生成中…';
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/context`, { cache:'no-store' });
    if (!response.ok) throw new Error(`GPT 上下文接口 HTTP ${response.status}`);
    const snapshot = await response.json();
    if (snapshot.schema !== 'aicc.v4.gpt-context.v1' || typeof snapshot.copyText !== 'string') throw new Error('GPT 上下文响应格式异常');
    await writeClipboard(snapshot.copyText);
    button.textContent = '已复制 ✓';
    setTimeout(() => { button.textContent = original; renderContextButton(); }, 1200);
  } catch (error) {
    button.textContent = '复制失败';
    button.title = error.message;
    setTimeout(() => { button.textContent = original; renderContextButton(); }, 1600);
  }
}

function runtimeCards(machines) {
  if (!machines?.length) return '<div class="runtime-empty">暂无已登记运行设备。</div>';
  return machines.map((machine) => `<article class="runtime-card">
    <div class="runtime-card-head"><span class="runtime-dot ${runtimeStatusClass(machine.status)}"></span><div><h3>${esc(machine.name)}</h3><p>${esc(machineRoleLabel(machine.role))}</p></div><b class="runtime-state ${runtimeStatusClass(machine.status)}">${esc(runtimeStatusLabel(machine))}</b></div>
    <dl><div><dt>主机</dt><dd>${esc(machine.hostname || '—')}</dd></div><div><dt>平台</dt><dd>${esc(machine.platform || '—')}</dd></div><div><dt>最近在线</dt><dd>${esc(machine.lastSeen || '—')}</dd></div><div><dt>关联项目</dt><dd>${esc((machine.projectIds || []).join(', ') || '—')}</dd></div></dl>
    ${(machine.observations || []).length ? `<div class="runtime-observations">${machine.observations.map((item) => `<div><strong>${esc(item.repository || '运行状态')}</strong><span>${esc(item.branch || '分支未知')}${item.runtime ? ` · ${esc(item.runtime)}` : ''}</span></div>`).join('')}</div>` : '<div class="runtime-observations muted">最新观测中暂无仓库/运行详情。</div>'}
  </article>`).join('');
}

function renderRuntimeOverview() {
  const runtime = state.runtime || { available:false, machines:[] };
  main.className = 'main-content';
  main.innerHTML = `<section class="page-heading"><div><p class="eyebrow">运行证据</p><h1>三台机器运行概览</h1><p>来自 GPT/DC 的只读观测；GitHub 仍是唯一项目事实源，AICC 不控制机器。</p></div><div class="headline-stats"><div><b>${runtime.machines?.filter((machine) => machine.status === 'ONLINE').length || 0}/${runtime.machines?.length || 3}</b><span>当前在线</span></div><div><b>${esc(runtimeObservationLabel(runtime.observationState))}</b><span>观测状态</span></div></div></section>
    <section class="runtime-meta"><span>来源：${esc(runtime.source || 'remote-desktop-commander')}</span><span>观测时间：${esc(runtime.observedAt || '暂无')}</span></section>
    <section class="runtime-grid">${runtimeCards(runtime.machines || [])}</section>
    ${!runtime.available ? '<section class="runtime-notice">当前没有本地运行观测；AICC 不会推断设备状态。</section>' : runtime.observationState === 'STALE_OBSERVATION' ? '<section class="runtime-notice warning">观测已过期；旧的“在线”记录不会被当作当前在线状态。</section>' : ''}`;
}

function renderOwnerAttentionCenter() {
  const items = allOwnerAttention();
  main.className = 'main-content';
  main.innerHTML = `<section class="page-heading"><div><p class="eyebrow">待我处理</p><h1>需要你处理</h1><p>这里只显示 GitHub 明确声明的负责人审批事项；AICC 不从 CI、草稿 PR 或标题自行推断。</p></div><div class="headline-stats"><div><b>${items.length}</b><span>明确待办</span></div></div></section>
    ${items.length ? `<section class="attention-list">${items.map((item) => `<button class="attention-card" data-attention-project="${esc(item.projectId)}" data-attention-id="${esc(item.id)}"><div><span class="attention-type">${esc(attentionTypeLabel(item.type))}</span><h2>${esc(item.title)}</h2><p>${esc(item.projectName)} · ${esc(item.repository)}</p></div><span class="attention-arrow">→</span></button>`).join('')}</section>` : '<section class="empty-state attention-empty"><span class="live-pill">无待办</span><h1>当前没有明确待我处理事项</h1><p>没有 GitHub 证据时，AICC 不会制造待办。</p></section>'}`;
  main.querySelectorAll('[data-attention-project]').forEach((button) => button.addEventListener('click', () => {
    state.attentionMode = false;
    state.viewProjectId = button.dataset.attentionProject;
    state.selectedNode = { projectId: button.dataset.attentionProject, kind: 'attention', id: button.dataset.attentionId };
    localStorage.setItem('aicc.v4.viewProjectId', state.viewProjectId);
    render();
  }));
}

function readTreeState(projectId) {
  try { return JSON.parse(localStorage.getItem(treeStorageKey(projectId)) || '{}'); }
  catch { return {}; }
}

function saveTreeState(projectId, key, open) {
  const current = readTreeState(projectId);
  current[key] = open;
  localStorage.setItem(treeStorageKey(projectId), JSON.stringify(current));
}

function renderSwitcher() {
  const current = state.viewProjectId === 'all' ? null : projectById(state.viewProjectId);
  switcherLabel.textContent = current?.name || '所有项目';
  const rows = [
    `<button class="switcher-item ${state.viewProjectId === 'all' ? 'active' : ''}" data-project-id="all" role="option"><span><strong>所有项目</strong><small>全局开发总览</small></span><b>${state.projects.length}</b></button>`,
    ...state.projects.map((project) => `<button class="switcher-item ${state.viewProjectId === project.projectId ? 'active' : ''}" data-project-id="${esc(project.projectId)}" role="option"><span><strong>${esc(project.name)}</strong><small>${esc(project.repository)}</small></span><b class="${project.available ? projectionStatus(project).toLowerCase() : 'bad'}">${project.available ? esc(projectionStatusLabel(projectionStatus(project))) : '错误'}</b></button>`)
  ];
  switcherMenu.innerHTML = rows.join('');
  switcherMenu.querySelectorAll('[data-project-id]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.projectId)));
}

function renderAllProjects() {
  const available = state.projects.filter((project) => project.available).length;
  const openPrs = state.projects.reduce((sum, project) => sum + (project.openPullRequests?.length || 0), 0);
  const ownerItems = allOwnerAttention().length;
  main.className = 'main-content';
  main.innerHTML = `
    <section class="page-heading">
      <div><p class="eyebrow">所有项目</p><h1>多项目开发总览</h1><p>所有状态均直接投影自 GitHub 默认分支；切换项目只改变当前视图。</p></div>
      <div class="headline-stats"><div><b>${available}/${state.projects.length}</b><span>GitHub 可用</span></div><div><b>${openPrs}</b><span>待处理 PR</span></div><div><b>${ownerItems}</b><span>待我处理</span></div></div>
    </section>
    <section class="runtime-strip"><div><p class="eyebrow">运行状态</p><h2>三机观测</h2></div><div class="runtime-mini">${(state.runtime?.machines || []).map((machine) => `<span><i class="runtime-dot ${runtimeStatusClass(machine.status)}"></i>${esc(machine.name)} <b>${esc(runtimeStatusLabel(machine))}</b></span>`).join('') || '<span>暂无运行观测</span>'}</div></section>
    <section class="project-grid">
      ${state.projects.map((project) => project.available ? `
        <button class="project-card" data-open-project="${esc(project.projectId)}">
          <div class="card-top"><span class="project-dot"></span>${projectionBadge(project)}</div>
          <h2>${esc(project.name)}</h2><p class="repo">${esc(project.repository)}</p>
          <div class="fact-row"><span>主线</span><strong class="mono">${esc(shortSha(project.mainSha))}</strong></div>
          <div class="fact-row"><span>待处理 PR</span><strong>${project.openPullRequests?.length || 0}</strong></div>
          <div class="fact-row"><span>CI</span><strong>${esc(ciSummary(project.ci))}</strong></div>
          <div class="fact-row"><span>路线图</span><strong>${esc(project.roadmap?.title || '未登记')}</strong></div>
          <div class="fact-row"><span>进度</span><strong>${esc(progressLabel(project.roadmap?.progress))}</strong></div>
          <div class="fact-row"><span>待我处理</span><strong>${project.ownerAttention?.length || 0}</strong></div>
          <div class="card-foot">${esc(freshness(project))}<span>→</span></div>
        </button>` : `
        <button class="project-card unavailable" data-open-project="${esc(project.projectId)}">
          <div class="card-top"><span class="project-dot"></span><span class="error-pill">不可用</span></div>
          <h2>${esc(project.name)}</h2><p class="repo">${esc(project.repository)}</p>
          <p class="error-copy">${esc(project.error?.message || 'GitHub 事实不可用')}</p><div class="card-foot">需要刷新<span>→</span></div>
        </button>`).join('')}
    </section>`;
  main.querySelectorAll('[data-open-project]').forEach((card) => card.addEventListener('click', () => setView(card.dataset.openProject)));
}

function outlineTree(nodes) {
  const root = [];
  const stack = [];
  for (const node of nodes || []) {
    const item = { ...node, children: [] };
    while (stack.length && stack.at(-1).level >= item.level) stack.pop();
    if (stack.length) stack.at(-1).children.push(item); else root.push(item);
    stack.push(item);
  }
  return root;
}

function treeBranch(project, node, treeState) {
  const key = `roadmap-${node.id}`;
  const open = treeState[key] ?? false;
  const progress = node.progress?.available ? `<b class="tree-progress">${esc(progressLabel(node.progress))}</b>` : '';
  const children = node.children?.length ? `<div class="tree-children">${node.children.map((child) => treeBranch(project, child, treeState)).join('')}</div>` : '';
  if (!children) return `<button class="tree-leaf" data-node-kind="roadmap" data-node-id="${esc(node.id)}"><span class="tree-dot"></span><span>${esc(node.title)}</span>${progress}</button>`;
  return `<details class="tree-branch" data-tree-key="${esc(key)}" ${open ? 'open' : ''}><summary><span>${esc(node.title)}</span>${progress}</summary>${children}</details>`;
}

function treeGroup(key, label, body, openDefault, treeState, badge = '') {
  const open = treeState[key] ?? openDefault;
  return `<details class="tree-group" data-tree-key="${esc(key)}" ${open ? 'open' : ''}><summary><span>${esc(label)}</span>${badge ? `<b>${esc(badge)}</b>` : ''}</summary><div class="tree-group-body">${body}</div></details>`;
}

function renderDevelopmentTree(project) {
  const treeState = readTreeState(project.projectId);
  const roadmapNodes = outlineTree(project.roadmap?.outline || []);
  const roadmapBody = project.roadmap ? [
    `<button class="tree-leaf strong" data-node-kind="summary" data-node-id="roadmap"><span class="tree-icon">◇</span><span>${esc(project.roadmap.title || '路线图')}</span></button>`,
    ...roadmapNodes.map((node) => treeBranch(project, node, treeState))
  ].join('') : '<div class="tree-empty">未登记路线图</div>';
  const wp = project.roadmap?.currentPointers?.workPackage;
  const task = project.roadmap?.currentPointers?.task;
  const currentBody = [
    wp ? `<button class="tree-leaf" data-node-kind="work-package" data-node-id="current"><span class="status-dot active"></span><span><small>工作包</small>${esc(wp.value)}</span></button>` : '<div class="tree-empty">未明确标记当前工作包</div>',
    task ? `<button class="tree-leaf" data-node-kind="task" data-node-id="current"><span class="status-dot active"></span><span><small>任务</small>${esc(task.value)}</span></button>` : '<div class="tree-empty">未明确标记当前任务</div>'
  ].join('');
  const prBody = project.openPullRequests?.length ? project.openPullRequests.map((pr) => `<button class="tree-leaf" data-node-kind="pr" data-node-id="${pr.number}"><span class="status-dot ${pr.draft ? 'draft' : 'active'}"></span><span><small>PR #${pr.number}</small>${esc(pr.title)}</span></button>`).join('') : '<div class="tree-empty">暂无待处理 PR</div>';
  const attentionItems = project.ownerAttention || [];
  const attentionBody = attentionItems.length ? attentionItems.map((item) => `<button class="tree-leaf attention-leaf" data-node-kind="attention" data-node-id="${esc(item.id)}"><span class="status-dot attention"></span><span><small>${esc(attentionTypeLabel(item.type))}</small>${esc(item.title)}</span></button>`).join('') : '<div class="tree-empty muted">暂无 GitHub 明确待我处理事项</div>';
  return `<aside class="development-tree" aria-label="项目目录">
    <div class="tree-title"><span>项目目录</span><strong>${esc(project.name)}</strong></div>
    ${treeGroup('group-roadmap', '路线图', roadmapBody, true, treeState, progressLabel(project.roadmap?.progress))}
    ${treeGroup('group-current', '工作包 / 任务', currentBody, true, treeState)}
    ${treeGroup('group-prs', '合并请求', prBody, true, treeState, String(project.openPullRequests?.length || 0))}
    ${treeGroup('group-attention', '待我处理', attentionBody, attentionItems.length > 0, treeState, attentionItems.length ? String(attentionItems.length) : '')}
  </aside>`;
}

function summaryDetail(project) {
  const suggested = clientSuggestedNext(project);
  return `<section class="page-heading project-heading"><div><p class="eyebrow">项目</p><h1>${esc(project.name)}</h1><p>${esc(project.repository)}</p></div>${projectionBadge(project)}</section>
    <section class="detail-grid">
      <article class="detail-card hero-card"><span>当前主线</span><strong class="mono">${esc(project.mainSha)}</strong><small>${esc(project.defaultBranch)} · GitHub 默认分支精确 HEAD</small></article>
      <article class="detail-card"><span>当前工作包</span><strong>${esc(project.roadmap?.currentWorkPackage || '未明确标记')}</strong><small>${project.roadmap?.currentPointers?.workPackage ? `GitHub 路线图第 ${project.roadmap.currentPointers.workPackage.line} 行` : '不做推断'}</small></article>
      <article class="detail-card"><span>当前任务</span><strong>${esc(project.roadmap?.currentTask || '未明确标记')}</strong><small>${project.roadmap?.currentPointers?.task ? `GitHub 路线图第 ${project.roadmap.currentPointers.task.line} 行` : '不做推断'}</small></article>
      <article class="detail-card"><span>待处理 PR</span><strong>${project.openPullRequests.length}</strong><small>${esc(ciSummary(project.ci))}</small></article>
      <article class="detail-card"><span>路线图进度</span><strong>${esc(progressLabel(project.roadmap?.progress))}</strong><small>${esc(progressEvidence(project.roadmap?.progress))}</small></article>
      <article class="detail-card"><span>待我处理</span><strong>${project.ownerAttention?.length || 0}</strong><small>仅显示 GitHub 明确待办</small></article>
      <article class="detail-card"><span>数据状态</span><strong>${esc(projectionStatusLabel(projectionStatus(project)))}</strong><small>${projectionStatus(project) === 'FRESH' ? '当前数据仍与 GitHub 一致' : '需要刷新/对账；GitHub 仍为权威事实源'}</small></article>
    </section>
    <section class="project-runtime"><div><p class="eyebrow">运行证据</p><h2>当前项目关联设备</h2></div><div class="runtime-mini">${runtimeDevicesForProject(project.projectId).map((machine) => `<span><i class="runtime-dot ${runtimeStatusClass(machine.status)}"></i>${esc(machine.name)} <b>${esc(runtimeStatusLabel(machine))}</b></span>`).join('') || '<span>最新观测中暂无关联设备</span>'}</div></section>
    <section class="context-panel"><div class="context-copy"><p class="eyebrow">GPT 项目上下文</p><h2>建议下一步 <span>仅建议</span></h2><strong>${esc(suggested.text)}</strong><p>${esc(suggested.reason)}</p><small>依据：${esc(suggested.evidence)} · AICC 不做决策或执行。</small></div><button class="primary-button context-copy-button" data-copy-context="${esc(project.projectId)}">复制 GPT 上下文</button></section>
    <section class="source-panel"><div><p class="eyebrow">GitHub 事实来源</p><h2>事实来源</h2></div><dl><div><dt>仓库</dt><dd>${esc(project.repository)}</dd></div><div><dt>GitHub SHA</dt><dd class="mono">${esc(project.provenance.ref)}</dd></div><div><dt>最近刷新</dt><dd>${esc(project.provenance.refreshedAt)}</dd></div></dl></section>`;
}

function selectedDetail(project) {
  const selection = state.selectedNode;
  if (!selection || selection.projectId !== project.projectId || selection.kind === 'summary') return summaryDetail(project);
  if (selection.kind === 'roadmap') {
    const node = project.roadmap?.outline?.find((item) => item.id === selection.id);
    if (!node) return summaryDetail(project);
    return `<section class="node-detail"><p class="eyebrow">路线图</p><h1>${esc(node.title)}</h1><p class="node-meta">${esc(project.roadmap.path)} · 第 ${node.line} 行 · main@${esc(shortSha(project.mainSha))}</p><div class="detail-copy"><p><strong>进度：${esc(progressLabel(node.progress))}</strong> · ${esc(progressEvidence(node.progress))}</p>${node.excerpt?.length ? node.excerpt.map((line) => `<p>${esc(line)}</p>`).join('') : '<p>该标题下暂无摘要。</p>'}</div><div class="evidence-strip"><span>GitHub 事实源</span><code>${esc(project.mainSha)}</code></div></section>`;
  }
  if (selection.kind === 'work-package' || selection.kind === 'task') {
    const pointer = selection.kind === 'work-package' ? project.roadmap?.currentPointers?.workPackage : project.roadmap?.currentPointers?.task;
    const title = selection.kind === 'work-package' ? '当前工作包' : '当前任务';
    if (!pointer) return summaryDetail(project);
    return `<section class="node-detail"><p class="eyebrow">${selection.kind === 'work-package' ? '工作包' : '任务'}</p><h1>${esc(pointer.value)}</h1><p class="node-meta">精确“${esc(title)}”标记 · ${esc(project.roadmap.path)} · 第 ${pointer.line} 行</p><div class="evidence-strip"><span>GitHub main</span><code>${esc(project.mainSha)}</code></div></section>`;
  }

  if (selection.kind === 'attention') {
    const item = (project.ownerAttention || []).find((entry) => entry.id === selection.id);
    if (!item) return summaryDetail(project);
    const source = item.source === 'pull-request' ? `GitHub PR #${item.prNumber}` : `${project.roadmap?.path || '路线图'} · 第 ${item.line} 行`;
    const link = item.url ? `<a href="${esc(item.url)}" target="_blank" rel="noreferrer">打开 GitHub 证据 ↗</a>` : 'GitHub main 路线图证据';
    return `<section class="node-detail"><p class="eyebrow">待我处理</p><h1>${esc(item.title)}</h1><p class="node-meta">${esc(attentionTypeLabel(item.type))} · ${esc(source)}</p><dl class="fact-list"><div><dt>状态</dt><dd>需要处理</dd></div><div><dt>来源</dt><dd>${link}</dd></div><div><dt>权威规则</dt><dd>以 GitHub 证据为准；GPT 操作前重新对账</dd></div></dl><div class="evidence-strip"><span>GitHub main</span><code>${esc(project.mainSha)}</code></div></section>`;
  }

  if (selection.kind === 'pr') {
    const pr = project.openPullRequests.find((item) => String(item.number) === String(selection.id));
    if (!pr) return summaryDetail(project);
    return `<section class="node-detail"><p class="eyebrow">合并请求</p><h1>#${pr.number} · ${esc(pr.title)}</h1><p class="node-meta">${pr.draft ? '草稿' : '打开'} · 目标分支 ${esc(pr.baseRef)} · 更新于 ${esc(pr.updatedAt || '未知')}</p><dl class="fact-list"><div><dt>源分支 SHA</dt><dd class="mono">${esc(pr.headSha || '—')}</dd></div><div><dt>GitHub</dt><dd>${pr.url ? `<a href="${esc(pr.url)}" target="_blank" rel="noreferrer">打开 PR ↗</a>` : 'URL 不可用'}</dd></div></dl><div class="evidence-strip"><span>来自 GitHub 投影</span><code>${esc(project.repository)}</code></div></section>`;
  }
  return summaryDetail(project);
}

function bindTree(project) {
  main.querySelectorAll('.development-tree details[data-tree-key]').forEach((details) => details.addEventListener('toggle', () => saveTreeState(project.projectId, details.dataset.treeKey, details.open)));
  main.querySelectorAll('[data-node-kind]').forEach((button) => button.addEventListener('click', () => {
    state.selectedNode = { projectId: project.projectId, kind: button.dataset.nodeKind, id: button.dataset.nodeId };
    renderProject(project);
  }));
  main.querySelectorAll('[data-copy-context]').forEach((button) => button.addEventListener('click', () => copyProjectContext(button.dataset.copyContext, button)));
}

function renderProject(project) {
  main.className = 'main-content project-workspace';
  if (!project?.available) {
    main.className = 'main-content';
    main.innerHTML = `<section class="empty-state"><span class="error-pill">不可用</span><h1>${esc(project?.name || '项目')}</h1><p>${esc(project?.error?.message || 'GitHub 事实不可用')}</p><button class="primary-button" id="backAll">返回所有项目</button></section>`;
    document.querySelector('#backAll')?.addEventListener('click', () => setView('all'));
    return;
  }
  main.innerHTML = `${renderDevelopmentTree(project)}<section class="detail-pane">${selectedDetail(project)}</section>`;
  bindTree(project);
}

function render() {
  renderSwitcher();
  renderAttentionButton();
  renderRuntimeButton();
  renderContextButton();
  refreshButton.disabled = state.loading;
  if (state.loading) { main.className = 'main-content'; main.innerHTML = '<section class="loading-state"><div class="spinner"></div><h1>正在读取 GitHub 项目事实</h1><p>不会读取本地分支作为项目权威。</p></section>'; statusbar.textContent = 'GitHub 事实源 · 刷新中…'; return; }
  if (state.error) { main.className = 'main-content'; main.innerHTML = `<section class="empty-state"><span class="error-pill">错误</span><h1>GitHub 项目事实读取失败</h1><p>${esc(state.error)}</p></section>`; statusbar.textContent = 'GitHub 事实源 · 刷新失败'; return; }
  if (state.runtimeMode) { renderRuntimeOverview(); statusbar.textContent = `运行证据 · ${runtimeObservationLabel(state.runtime?.observationState)} · 观测于 ${state.runtime?.observedAt || '未知'}`; return; }
  if (state.attentionMode) { renderOwnerAttentionCenter(); const latest = state.projects.map((project) => project.provenance?.refreshedAt).filter(Boolean).sort().at(-1); statusbar.textContent = `GitHub 事实源 · 待我处理 · 同步于 ${latest || '未知'}`; return; }
  const selected = state.viewProjectId === 'all' ? null : projectById(state.viewProjectId);
  if (state.viewProjectId !== 'all' && !selected) state.viewProjectId = 'all';
  state.viewProjectId === 'all' ? renderAllProjects() : renderProject(selected);
  const latest = state.projects.map((project) => project.provenance?.refreshedAt).filter(Boolean).sort().at(-1);
  statusbar.textContent = `GitHub 事实源 · ${state.projects.length} 个项目视图 · 同步于 ${latest || '未知'}`;
}

function setView(projectId) {
  state.attentionMode = false;
  state.runtimeMode = false;
  state.viewProjectId = projectId;
  state.selectedNode = null;
  localStorage.setItem('aicc.v4.viewProjectId', projectId);
  switcherMenu.hidden = true;
  switcherButton.setAttribute('aria-expanded', 'false');
  render();
}

async function refresh() {
  const epoch = ++refreshEpoch;
  state.loading = true; state.error = null; render();
  try {
    const [projectResponse, runtimeResponse] = await Promise.all([
      fetch('/api/projects', { cache: 'no-store' }),
      fetch('/api/runtime', { cache: 'no-store' })
    ]);
    if (!projectResponse.ok) throw new Error(`项目接口 HTTP ${projectResponse.status}`);
    const payload = await projectResponse.json();
    if (payload.schema !== 'aicc.v4.projects.v1' || !Array.isArray(payload.projects)) throw new Error('AICC V4 API 响应格式异常');
    if (epoch !== refreshEpoch) return;
    state.projects = payload.projects;
    state.freshness = Object.fromEntries(payload.projects.filter((project) => project.available).map((project) => [project.projectId, { status: 'FRESH', expectedRef: project.mainSha, currentRef: project.mainSha }]));
    state.runtime = runtimeResponse.ok ? await runtimeResponse.json() : { available:false, observationState:'UNAVAILABLE', machines:[] };
  } catch (error) { if (epoch === refreshEpoch) state.error = error.message; }
  finally { if (epoch === refreshEpoch) { state.loading = false; render(); } }
}

async function checkFreshness() {
  const checks = state.projects.filter((project) => project.available).map(async (project) => {
    try {
      const params = new URLSearchParams({ ref: project.mainSha, repository: project.repository });
      const response = await fetch(`/api/projects/${encodeURIComponent(project.projectId)}/freshness?${params}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      state.freshness[project.projectId] = result;
    } catch { state.freshness[project.projectId] = { status: 'UNKNOWN' }; }
  });
  await Promise.all(checks);
  if (!state.loading && !state.error) render();
}

switcherButton.addEventListener('click', () => { switcherMenu.hidden = !switcherMenu.hidden; switcherButton.setAttribute('aria-expanded', String(!switcherMenu.hidden)); });
document.addEventListener('click', (event) => { if (!switcher.contains(event.target)) { switcherMenu.hidden = true; switcherButton.setAttribute('aria-expanded', 'false'); } });
attentionButton.addEventListener('click', () => { state.runtimeMode = false; state.attentionMode = true; state.selectedNode = null; render(); });
runtimeButton.addEventListener('click', () => { state.attentionMode = false; state.runtimeMode = true; state.selectedNode = null; render(); });
contextButton.addEventListener('click', () => { if (state.viewProjectId !== 'all') copyProjectContext(state.viewProjectId, contextButton); });
refreshButton.addEventListener('click', refresh);
refresh();
setInterval(checkFreshness, 60000);
