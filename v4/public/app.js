const state = {
  projects: [],
  viewProjectId: localStorage.getItem('aicc.v4.viewProjectId') || 'all',
  selectedNode: null,
  freshness: {},
  attentionMode: false,
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
const attentionButton = document.querySelector('#attentionButton');
const attentionCount = document.querySelector('#attentionCount');

const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const shortSha = (sha) => sha ? sha.slice(0, 10) : '—';
const projectById = (id) => state.projects.find((project) => project.projectId === id);
const treeStorageKey = (projectId) => `aicc.v4.treeState.${projectId}`;

function ciSummary(ci) {
  if (!ci) return 'No CI facts';
  const total = Number(ci.total || 0);
  if (!total) return 'No checks on main';
  const success = Number(ci.byConclusion?.success || 0);
  const failure = Number(ci.byConclusion?.failure || 0);
  const pending = Number(ci.byStatus?.in_progress || 0) + Number(ci.byStatus?.queued || 0);
  return `${total} checks · ${success} success${failure ? ` · ${failure} failed` : ''}${pending ? ` · ${pending} running` : ''}`;
}

function freshness(project) {
  return project?.provenance?.ref ? `GitHub main@${shortSha(project.provenance.ref)}` : 'GitHub facts unavailable';
}

function progressLabel(progress) {
  return progress?.available ? `${progress.percentage}%` : '—';
}

function progressEvidence(progress) {
  if (!progress?.available) return 'No GitHub progress evidence';
  if (progress.basis === 'explicit-percent') return `Explicit Progress label${progress.line ? ` · line ${progress.line}` : ''}`;
  return `${progress.completed}/${progress.total} GitHub Markdown checklist items`;
}

function projectionStatus(project) {
  if (!project?.available) return 'UNKNOWN';
  if (project.provenance?.repository !== project.repository || project.provenance?.ref !== project.mainSha) return 'DRIFT';
  return state.freshness[project.projectId]?.status || 'FRESH';
}

function projectionBadge(project) {
  const status = projectionStatus(project);
  return `<span class="projection-pill ${status.toLowerCase()}">${esc(status)}</span>`;
}


function allOwnerAttention() {
  return state.projects.flatMap((project) => (project.ownerAttention || []).map((item) => ({ ...item, projectId: project.projectId, projectName: project.name, repository: project.repository })));
}

function attentionTypeLabel(type) {
  return ({ HUMAN_UAT:'Human UAT', MERGE_APPROVAL:'Merge Approval', DEPLOY_APPROVAL:'Deploy Approval', PRODUCTION_GATE:'Production Gate', OWNER_DECISION:'Owner Decision', OWNER_ACTION:'Owner Action' })[type] || type || 'Owner Action';
}

function renderAttentionButton() {
  const count = allOwnerAttention().length;
  attentionCount.textContent = String(count);
  attentionButton.classList.toggle('has-attention', count > 0);
  attentionButton.title = count ? `${count} explicit GitHub Owner attention item${count === 1 ? '' : 's'}` : 'No explicit GitHub Owner attention items';
}

function renderOwnerAttentionCenter() {
  const items = allOwnerAttention();
  main.className = 'main-content';
  main.innerHTML = `<section class="page-heading"><div><p class="eyebrow">OWNER ATTENTION</p><h1>需要你处理</h1><p>这里只显示 GitHub 明确声明的 Owner Gate；AICC 不从 CI、Draft PR 或标题自行推断。</p></div><div class="headline-stats"><div><b>${items.length}</b><span>Explicit Gates</span></div></div></section>
    ${items.length ? `<section class="attention-list">${items.map((item) => `<button class="attention-card" data-attention-project="${esc(item.projectId)}" data-attention-id="${esc(item.id)}"><div><span class="attention-type">${esc(attentionTypeLabel(item.type))}</span><h2>${esc(item.title)}</h2><p>${esc(item.projectName)} · ${esc(item.repository)}</p></div><span class="attention-arrow">→</span></button>`).join('')}</section>` : '<section class="empty-state attention-empty"><span class="live-pill">CLEAR</span><h1>当前没有显式 Owner Gate</h1><p>没有 GitHub 证据时，AICC 不会制造待办。</p></section>'}`;
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
  switcherLabel.textContent = current?.name || 'All Projects';
  const rows = [
    `<button class="switcher-item ${state.viewProjectId === 'all' ? 'active' : ''}" data-project-id="all" role="option"><span><strong>All Projects</strong><small>全局开发总览</small></span><b>${state.projects.length}</b></button>`,
    ...state.projects.map((project) => `<button class="switcher-item ${state.viewProjectId === project.projectId ? 'active' : ''}" data-project-id="${esc(project.projectId)}" role="option"><span><strong>${esc(project.name)}</strong><small>${esc(project.repository)}</small></span><b class="${project.available ? projectionStatus(project).toLowerCase() : 'bad'}">${project.available ? esc(projectionStatus(project)) : 'ERROR'}</b></button>`)
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
      <div><p class="eyebrow">ALL PROJECTS</p><h1>多项目开发总览</h1><p>所有状态均直接投影自 GitHub 默认分支；切换项目只改变当前视图。</p></div>
      <div class="headline-stats"><div><b>${available}/${state.projects.length}</b><span>GitHub Available</span></div><div><b>${openPrs}</b><span>Open PR</span></div><div><b>${ownerItems}</b><span>Owner Attention</span></div></div>
    </section>
    <section class="project-grid">
      ${state.projects.map((project) => project.available ? `
        <button class="project-card" data-open-project="${esc(project.projectId)}">
          <div class="card-top"><span class="project-dot"></span>${projectionBadge(project)}</div>
          <h2>${esc(project.name)}</h2><p class="repo">${esc(project.repository)}</p>
          <div class="fact-row"><span>Main</span><strong class="mono">${esc(shortSha(project.mainSha))}</strong></div>
          <div class="fact-row"><span>Open PR</span><strong>${project.openPullRequests?.length || 0}</strong></div>
          <div class="fact-row"><span>CI</span><strong>${esc(ciSummary(project.ci))}</strong></div>
          <div class="fact-row"><span>Roadmap</span><strong>${esc(project.roadmap?.title || 'Not registered')}</strong></div>
          <div class="fact-row"><span>Progress</span><strong>${esc(progressLabel(project.roadmap?.progress))}</strong></div>
          <div class="fact-row"><span>Owner Attention</span><strong>${project.ownerAttention?.length || 0}</strong></div>
          <div class="card-foot">${esc(freshness(project))}<span>→</span></div>
        </button>` : `
        <button class="project-card unavailable" data-open-project="${esc(project.projectId)}">
          <div class="card-top"><span class="project-dot"></span><span class="error-pill">UNAVAILABLE</span></div>
          <h2>${esc(project.name)}</h2><p class="repo">${esc(project.repository)}</p>
          <p class="error-copy">${esc(project.error?.message || 'GitHub facts unavailable')}</p><div class="card-foot">Refresh required<span>→</span></div>
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
    `<button class="tree-leaf strong" data-node-kind="summary" data-node-id="roadmap"><span class="tree-icon">◇</span><span>${esc(project.roadmap.title || 'Roadmap')}</span></button>`,
    ...roadmapNodes.map((node) => treeBranch(project, node, treeState))
  ].join('') : '<div class="tree-empty">No roadmap registered</div>';
  const wp = project.roadmap?.currentPointers?.workPackage;
  const task = project.roadmap?.currentPointers?.task;
  const currentBody = [
    wp ? `<button class="tree-leaf" data-node-kind="work-package" data-node-id="current"><span class="status-dot active"></span><span><small>WP</small>${esc(wp.value)}</span></button>` : '<div class="tree-empty">No explicit Current WP label</div>',
    task ? `<button class="tree-leaf" data-node-kind="task" data-node-id="current"><span class="status-dot active"></span><span><small>Task</small>${esc(task.value)}</span></button>` : '<div class="tree-empty">No explicit Current Task label</div>'
  ].join('');
  const prBody = project.openPullRequests?.length ? project.openPullRequests.map((pr) => `<button class="tree-leaf" data-node-kind="pr" data-node-id="${pr.number}"><span class="status-dot ${pr.draft ? 'draft' : 'active'}"></span><span><small>PR #${pr.number}</small>${esc(pr.title)}</span></button>`).join('') : '<div class="tree-empty">No open pull requests</div>';
  const attentionItems = project.ownerAttention || [];
  const attentionBody = attentionItems.length ? attentionItems.map((item) => `<button class="tree-leaf attention-leaf" data-node-kind="attention" data-node-id="${esc(item.id)}"><span class="status-dot attention"></span><span><small>${esc(attentionTypeLabel(item.type))}</small>${esc(item.title)}</span></button>`).join('') : '<div class="tree-empty muted">No explicit GitHub Owner Gate</div>';
  return `<aside class="development-tree" aria-label="Development Tree">
    <div class="tree-title"><span>PROJECT TREE</span><strong>${esc(project.name)}</strong></div>
    ${treeGroup('group-roadmap', 'Roadmap', roadmapBody, true, treeState, progressLabel(project.roadmap?.progress))}
    ${treeGroup('group-current', 'WP / Task', currentBody, true, treeState)}
    ${treeGroup('group-prs', 'Pull Requests', prBody, true, treeState, String(project.openPullRequests?.length || 0))}
    ${treeGroup('group-attention', 'Owner Attention', attentionBody, attentionItems.length > 0, treeState, attentionItems.length ? String(attentionItems.length) : '')}
  </aside>`;
}

function summaryDetail(project) {
  return `<section class="page-heading project-heading"><div><p class="eyebrow">PROJECT</p><h1>${esc(project.name)}</h1><p>${esc(project.repository)}</p></div>${projectionBadge(project)}</section>
    <section class="detail-grid">
      <article class="detail-card hero-card"><span>Canonical Main</span><strong class="mono">${esc(project.mainSha)}</strong><small>${esc(project.defaultBranch)} · exact GitHub default-branch head</small></article>
      <article class="detail-card"><span>Current Work Package</span><strong>${esc(project.roadmap?.currentWorkPackage || 'Not explicitly labeled')}</strong><small>${project.roadmap?.currentPointers?.workPackage ? `GitHub roadmap line ${project.roadmap.currentPointers.workPackage.line}` : 'No inference'}</small></article>
      <article class="detail-card"><span>Current Task</span><strong>${esc(project.roadmap?.currentTask || 'Not explicitly labeled')}</strong><small>${project.roadmap?.currentPointers?.task ? `GitHub roadmap line ${project.roadmap.currentPointers.task.line}` : 'No inference'}</small></article>
      <article class="detail-card"><span>Open Pull Requests</span><strong>${project.openPullRequests.length}</strong><small>${esc(ciSummary(project.ci))}</small></article>
      <article class="detail-card"><span>Roadmap Progress</span><strong>${esc(progressLabel(project.roadmap?.progress))}</strong><small>${esc(progressEvidence(project.roadmap?.progress))}</small></article>
      <article class="detail-card"><span>Owner Attention</span><strong>${project.ownerAttention?.length || 0}</strong><small>Explicit GitHub gates only</small></article>
      <article class="detail-card"><span>Projection</span><strong>${esc(projectionStatus(project))}</strong><small>${projectionStatus(project) === 'FRESH' ? 'Loaded exact ref still matches GitHub' : 'Refresh/reconciliation required; GitHub remains authoritative'}</small></article>
    </section>
    <section class="source-panel"><div><p class="eyebrow">GITHUB PROVENANCE</p><h2>事实来源</h2></div><dl><div><dt>Repository</dt><dd>${esc(project.repository)}</dd></div><div><dt>Ref</dt><dd class="mono">${esc(project.provenance.ref)}</dd></div><div><dt>Refreshed</dt><dd>${esc(project.provenance.refreshedAt)}</dd></div></dl></section>`;
}

function selectedDetail(project) {
  const selection = state.selectedNode;
  if (!selection || selection.projectId !== project.projectId || selection.kind === 'summary') return summaryDetail(project);
  if (selection.kind === 'roadmap') {
    const node = project.roadmap?.outline?.find((item) => item.id === selection.id);
    if (!node) return summaryDetail(project);
    return `<section class="node-detail"><p class="eyebrow">ROADMAP</p><h1>${esc(node.title)}</h1><p class="node-meta">${esc(project.roadmap.path)} · line ${node.line} · main@${esc(shortSha(project.mainSha))}</p><div class="detail-copy"><p><strong>Progress: ${esc(progressLabel(node.progress))}</strong> · ${esc(progressEvidence(node.progress))}</p>${node.excerpt?.length ? node.excerpt.map((line) => `<p>${esc(line)}</p>`).join('') : '<p>No excerpt under this heading.</p>'}</div><div class="evidence-strip"><span>GitHub source</span><code>${esc(project.mainSha)}</code></div></section>`;
  }
  if (selection.kind === 'work-package' || selection.kind === 'task') {
    const pointer = selection.kind === 'work-package' ? project.roadmap?.currentPointers?.workPackage : project.roadmap?.currentPointers?.task;
    const title = selection.kind === 'work-package' ? 'Current Work Package' : 'Current Task';
    if (!pointer) return summaryDetail(project);
    return `<section class="node-detail"><p class="eyebrow">${selection.kind === 'work-package' ? 'WORK PACKAGE' : 'TASK'}</p><h1>${esc(pointer.value)}</h1><p class="node-meta">Exact ${esc(title)} label · ${esc(project.roadmap.path)} · line ${pointer.line}</p><div class="evidence-strip"><span>GitHub main</span><code>${esc(project.mainSha)}</code></div></section>`;
  }

  if (selection.kind === 'attention') {
    const item = (project.ownerAttention || []).find((entry) => entry.id === selection.id);
    if (!item) return summaryDetail(project);
    const source = item.source === 'pull-request' ? `GitHub PR #${item.prNumber}` : `${project.roadmap?.path || 'Roadmap'} · line ${item.line}`;
    const link = item.url ? `<a href="${esc(item.url)}" target="_blank" rel="noreferrer">Open GitHub evidence ↗</a>` : 'GitHub main roadmap evidence';
    return `<section class="node-detail"><p class="eyebrow">OWNER ATTENTION</p><h1>${esc(item.title)}</h1><p class="node-meta">${esc(attentionTypeLabel(item.type))} · ${esc(source)}</p><dl class="fact-list"><div><dt>Status</dt><dd>REQUIRED</dd></div><div><dt>Source</dt><dd>${link}</dd></div><div><dt>Authority</dt><dd>GitHub evidence; GPT reconciles before action</dd></div></dl><div class="evidence-strip"><span>GitHub main</span><code>${esc(project.mainSha)}</code></div></section>`;
  }

  if (selection.kind === 'pr') {
    const pr = project.openPullRequests.find((item) => String(item.number) === String(selection.id));
    if (!pr) return summaryDetail(project);
    return `<section class="node-detail"><p class="eyebrow">PULL REQUEST</p><h1>#${pr.number} · ${esc(pr.title)}</h1><p class="node-meta">${pr.draft ? 'Draft' : 'Open'} · base ${esc(pr.baseRef)} · updated ${esc(pr.updatedAt || 'unknown')}</p><dl class="fact-list"><div><dt>Head SHA</dt><dd class="mono">${esc(pr.headSha || '—')}</dd></div><div><dt>GitHub</dt><dd>${pr.url ? `<a href="${esc(pr.url)}" target="_blank" rel="noreferrer">Open PR ↗</a>` : 'URL unavailable'}</dd></div></dl><div class="evidence-strip"><span>Projected from GitHub</span><code>${esc(project.repository)}</code></div></section>`;
  }
  return summaryDetail(project);
}

function bindTree(project) {
  main.querySelectorAll('.development-tree details[data-tree-key]').forEach((details) => details.addEventListener('toggle', () => saveTreeState(project.projectId, details.dataset.treeKey, details.open)));
  main.querySelectorAll('[data-node-kind]').forEach((button) => button.addEventListener('click', () => {
    state.selectedNode = { projectId: project.projectId, kind: button.dataset.nodeKind, id: button.dataset.nodeId };
    renderProject(project);
  }));
}

function renderProject(project) {
  main.className = 'main-content project-workspace';
  if (!project?.available) {
    main.className = 'main-content';
    main.innerHTML = `<section class="empty-state"><span class="error-pill">UNAVAILABLE</span><h1>${esc(project?.name || 'Project')}</h1><p>${esc(project?.error?.message || 'GitHub facts unavailable')}</p><button class="primary-button" id="backAll">Back to All Projects</button></section>`;
    document.querySelector('#backAll')?.addEventListener('click', () => setView('all'));
    return;
  }
  main.innerHTML = `${renderDevelopmentTree(project)}<section class="detail-pane">${selectedDetail(project)}</section>`;
  bindTree(project);
}

function render() {
  renderSwitcher();
  renderAttentionButton();
  if (state.loading) { main.className = 'main-content'; main.innerHTML = '<section class="loading-state"><div class="spinner"></div><h1>正在读取 GitHub 项目事实</h1><p>不会读取本地 branch 作为项目权威。</p></section>'; statusbar.textContent = 'GitHub source · refreshing…'; return; }
  if (state.error) { main.className = 'main-content'; main.innerHTML = `<section class="empty-state"><span class="error-pill">ERROR</span><h1>GitHub 项目事实读取失败</h1><p>${esc(state.error)}</p></section>`; statusbar.textContent = 'GitHub source · refresh failed'; return; }
  if (state.attentionMode) { renderOwnerAttentionCenter(); const latest = state.projects.map((project) => project.provenance?.refreshedAt).filter(Boolean).sort().at(-1); statusbar.textContent = `GitHub source · Owner Attention · synced ${latest || 'unknown'}`; return; }
  const selected = state.viewProjectId === 'all' ? null : projectById(state.viewProjectId);
  if (state.viewProjectId !== 'all' && !selected) state.viewProjectId = 'all';
  state.viewProjectId === 'all' ? renderAllProjects() : renderProject(selected);
  const latest = state.projects.map((project) => project.provenance?.refreshedAt).filter(Boolean).sort().at(-1);
  statusbar.textContent = `GitHub source · ${state.projects.length} project views · synced ${latest || 'unknown'}`;
}

function setView(projectId) {
  state.attentionMode = false;
  state.viewProjectId = projectId;
  state.selectedNode = null;
  localStorage.setItem('aicc.v4.viewProjectId', projectId);
  switcherMenu.hidden = true;
  switcherButton.setAttribute('aria-expanded', 'false');
  render();
}

async function refresh() {
  state.loading = true; state.error = null; render();
  try {
    const response = await fetch('/api/projects', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.schema !== 'aicc.v4.projects.v1' || !Array.isArray(payload.projects)) throw new Error('Unexpected AICC V4 API response');
    state.projects = payload.projects;
    state.freshness = Object.fromEntries(payload.projects.filter((project) => project.available).map((project) => [project.projectId, { status: 'FRESH', expectedRef: project.mainSha, currentRef: project.mainSha }]));
  } catch (error) { state.error = error.message; }
  finally { state.loading = false; render(); }
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
attentionButton.addEventListener('click', () => { state.attentionMode = true; state.selectedNode = null; render(); });
refreshButton.addEventListener('click', refresh);
refresh();
setInterval(checkFreshness, 60000);
