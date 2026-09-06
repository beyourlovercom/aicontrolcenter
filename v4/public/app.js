const state = {
  projects: [],
  viewProjectId: localStorage.getItem('aicc.v4.viewProjectId') || 'all',
  selectedNode: null,
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
    ...state.projects.map((project) => `<button class="switcher-item ${state.viewProjectId === project.projectId ? 'active' : ''}" data-project-id="${esc(project.projectId)}" role="option"><span><strong>${esc(project.name)}</strong><small>${esc(project.repository)}</small></span><b class="${project.available ? 'ok' : 'bad'}">${project.available ? 'LIVE' : 'ERROR'}</b></button>`)
  ];
  switcherMenu.innerHTML = rows.join('');
  switcherMenu.querySelectorAll('[data-project-id]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.projectId)));
}

function renderAllProjects() {
  const available = state.projects.filter((project) => project.available).length;
  const openPrs = state.projects.reduce((sum, project) => sum + (project.openPullRequests?.length || 0), 0);
  main.className = 'main-content';
  main.innerHTML = `
    <section class="page-heading">
      <div><p class="eyebrow">ALL PROJECTS</p><h1>多项目开发总览</h1><p>所有状态均直接投影自 GitHub 默认分支；切换项目只改变当前视图。</p></div>
      <div class="headline-stats"><div><b>${available}/${state.projects.length}</b><span>GitHub Available</span></div><div><b>${openPrs}</b><span>Open PR</span></div></div>
    </section>
    <section class="project-grid">
      ${state.projects.map((project) => project.available ? `
        <button class="project-card" data-open-project="${esc(project.projectId)}">
          <div class="card-top"><span class="project-dot"></span><span class="live-pill">GITHUB LIVE</span></div>
          <h2>${esc(project.name)}</h2><p class="repo">${esc(project.repository)}</p>
          <div class="fact-row"><span>Main</span><strong class="mono">${esc(shortSha(project.mainSha))}</strong></div>
          <div class="fact-row"><span>Open PR</span><strong>${project.openPullRequests?.length || 0}</strong></div>
          <div class="fact-row"><span>CI</span><strong>${esc(ciSummary(project.ci))}</strong></div>
          <div class="fact-row"><span>Roadmap</span><strong>${esc(project.roadmap?.title || 'Not registered')}</strong></div>
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
  const children = node.children?.length ? `<div class="tree-children">${node.children.map((child) => treeBranch(project, child, treeState)).join('')}</div>` : '';
  if (!children) return `<button class="tree-leaf" data-node-kind="roadmap" data-node-id="${esc(node.id)}"><span class="tree-dot"></span><span>${esc(node.title)}</span></button>`;
  return `<details class="tree-branch" data-tree-key="${esc(key)}" ${open ? 'open' : ''}><summary>${esc(node.title)}</summary>${children}</details>`;
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
  const attentionBody = '<div class="tree-empty muted">Owner Attention projection starts in V4.5</div>';
  return `<aside class="development-tree" aria-label="Development Tree">
    <div class="tree-title"><span>PROJECT TREE</span><strong>${esc(project.name)}</strong></div>
    ${treeGroup('group-roadmap', 'Roadmap', roadmapBody, true, treeState)}
    ${treeGroup('group-current', 'WP / Task', currentBody, true, treeState)}
    ${treeGroup('group-prs', 'Pull Requests', prBody, true, treeState, String(project.openPullRequests?.length || 0))}
    ${treeGroup('group-attention', 'Owner Attention', attentionBody, false, treeState)}
  </aside>`;
}

function summaryDetail(project) {
  return `<section class="page-heading project-heading"><div><p class="eyebrow">PROJECT</p><h1>${esc(project.name)}</h1><p>${esc(project.repository)}</p></div><span class="live-pill">GITHUB LIVE</span></section>
    <section class="detail-grid">
      <article class="detail-card hero-card"><span>Canonical Main</span><strong class="mono">${esc(project.mainSha)}</strong><small>${esc(project.defaultBranch)} · exact GitHub default-branch head</small></article>
      <article class="detail-card"><span>Current Work Package</span><strong>${esc(project.roadmap?.currentWorkPackage || 'Not explicitly labeled')}</strong><small>${project.roadmap?.currentPointers?.workPackage ? `GitHub roadmap line ${project.roadmap.currentPointers.workPackage.line}` : 'No inference'}</small></article>
      <article class="detail-card"><span>Current Task</span><strong>${esc(project.roadmap?.currentTask || 'Not explicitly labeled')}</strong><small>${project.roadmap?.currentPointers?.task ? `GitHub roadmap line ${project.roadmap.currentPointers.task.line}` : 'No inference'}</small></article>
      <article class="detail-card"><span>Open Pull Requests</span><strong>${project.openPullRequests.length}</strong><small>${esc(ciSummary(project.ci))}</small></article>
    </section>
    <section class="source-panel"><div><p class="eyebrow">GITHUB PROVENANCE</p><h2>事实来源</h2></div><dl><div><dt>Repository</dt><dd>${esc(project.repository)}</dd></div><div><dt>Ref</dt><dd class="mono">${esc(project.provenance.ref)}</dd></div><div><dt>Refreshed</dt><dd>${esc(project.provenance.refreshedAt)}</dd></div></dl></section>`;
}

function selectedDetail(project) {
  const selection = state.selectedNode;
  if (!selection || selection.projectId !== project.projectId || selection.kind === 'summary') return summaryDetail(project);
  if (selection.kind === 'roadmap') {
    const node = project.roadmap?.outline?.find((item) => item.id === selection.id);
    if (!node) return summaryDetail(project);
    return `<section class="node-detail"><p class="eyebrow">ROADMAP</p><h1>${esc(node.title)}</h1><p class="node-meta">${esc(project.roadmap.path)} · line ${node.line} · main@${esc(shortSha(project.mainSha))}</p><div class="detail-copy">${node.excerpt?.length ? node.excerpt.map((line) => `<p>${esc(line)}</p>`).join('') : '<p>No excerpt under this heading.</p>'}</div><div class="evidence-strip"><span>GitHub source</span><code>${esc(project.mainSha)}</code></div></section>`;
  }
  if (selection.kind === 'work-package' || selection.kind === 'task') {
    const pointer = selection.kind === 'work-package' ? project.roadmap?.currentPointers?.workPackage : project.roadmap?.currentPointers?.task;
    const title = selection.kind === 'work-package' ? 'Current Work Package' : 'Current Task';
    if (!pointer) return summaryDetail(project);
    return `<section class="node-detail"><p class="eyebrow">${selection.kind === 'work-package' ? 'WORK PACKAGE' : 'TASK'}</p><h1>${esc(pointer.value)}</h1><p class="node-meta">Exact ${esc(title)} label · ${esc(project.roadmap.path)} · line ${pointer.line}</p><div class="evidence-strip"><span>GitHub main</span><code>${esc(project.mainSha)}</code></div></section>`;
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
  if (state.loading) { main.className = 'main-content'; main.innerHTML = '<section class="loading-state"><div class="spinner"></div><h1>正在读取 GitHub 项目事实</h1><p>不会读取本地 branch 作为项目权威。</p></section>'; statusbar.textContent = 'GitHub source · refreshing…'; return; }
  if (state.error) { main.className = 'main-content'; main.innerHTML = `<section class="empty-state"><span class="error-pill">ERROR</span><h1>GitHub 项目事实读取失败</h1><p>${esc(state.error)}</p></section>`; statusbar.textContent = 'GitHub source · refresh failed'; return; }
  const selected = state.viewProjectId === 'all' ? null : projectById(state.viewProjectId);
  if (state.viewProjectId !== 'all' && !selected) state.viewProjectId = 'all';
  state.viewProjectId === 'all' ? renderAllProjects() : renderProject(selected);
  const latest = state.projects.map((project) => project.provenance?.refreshedAt).filter(Boolean).sort().at(-1);
  statusbar.textContent = `GitHub source · ${state.projects.length} project views · synced ${latest || 'unknown'}`;
}

function setView(projectId) {
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
  } catch (error) { state.error = error.message; }
  finally { state.loading = false; render(); }
}

switcherButton.addEventListener('click', () => { switcherMenu.hidden = !switcherMenu.hidden; switcherButton.setAttribute('aria-expanded', String(!switcherMenu.hidden)); });
document.addEventListener('click', (event) => { if (!switcher.contains(event.target)) { switcherMenu.hidden = true; switcherButton.setAttribute('aria-expanded', 'false'); } });
refreshButton.addEventListener('click', refresh);
refresh();
