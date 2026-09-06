const state = {
  projects: [],
  viewProjectId: localStorage.getItem('aicc.v4.viewProjectId') || 'all',
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
  main.innerHTML = `
    <section class="page-heading">
      <div><p class="eyebrow">ALL PROJECTS</p><h1>多项目开发总览</h1><p>所有状态均直接投影自 GitHub 默认分支；切换项目只改变当前视图。</p></div>
      <div class="headline-stats"><div><b>${available}/${state.projects.length}</b><span>GitHub Available</span></div><div><b>${openPrs}</b><span>Open PR</span></div></div>
    </section>
    <section class="project-grid">
      ${state.projects.map((project) => project.available ? `
        <button class="project-card" data-open-project="${esc(project.projectId)}">
          <div class="card-top"><span class="project-dot"></span><span class="live-pill">GITHUB LIVE</span></div>
          <h2>${esc(project.name)}</h2>
          <p class="repo">${esc(project.repository)}</p>
          <div class="fact-row"><span>Main</span><strong class="mono">${esc(shortSha(project.mainSha))}</strong></div>
          <div class="fact-row"><span>Open PR</span><strong>${project.openPullRequests?.length || 0}</strong></div>
          <div class="fact-row"><span>CI</span><strong>${esc(ciSummary(project.ci))}</strong></div>
          <div class="fact-row"><span>Roadmap</span><strong>${esc(project.roadmap?.title || 'Not registered')}</strong></div>
          <div class="card-foot">${esc(freshness(project))}<span>→</span></div>
        </button>` : `
        <button class="project-card unavailable" data-open-project="${esc(project.projectId)}">
          <div class="card-top"><span class="project-dot"></span><span class="error-pill">UNAVAILABLE</span></div>
          <h2>${esc(project.name)}</h2><p class="repo">${esc(project.repository)}</p>
          <p class="error-copy">${esc(project.error?.message || 'GitHub facts unavailable')}</p>
          <div class="card-foot">Refresh required<span>→</span></div>
        </button>`).join('')}
    </section>`;
  main.querySelectorAll('[data-open-project]').forEach((card) => card.addEventListener('click', () => setView(card.dataset.openProject)));
}

function renderProject(project) {
  if (!project?.available) {
    main.innerHTML = `<section class="empty-state"><span class="error-pill">UNAVAILABLE</span><h1>${esc(project?.name || 'Project')}</h1><p>${esc(project?.error?.message || 'GitHub facts unavailable')}</p><button class="primary-button" id="backAll">Back to All Projects</button></section>`;
    document.querySelector('#backAll')?.addEventListener('click', () => setView('all'));
    return;
  }
  main.innerHTML = `
    <section class="page-heading project-heading">
      <div><p class="eyebrow">PROJECT</p><h1>${esc(project.name)}</h1><p>${esc(project.repository)}</p></div>
      <span class="live-pill">GITHUB LIVE</span>
    </section>
    <section class="detail-grid">
      <article class="detail-card hero-card"><span>Canonical Main</span><strong class="mono">${esc(project.mainSha)}</strong><small>${esc(project.defaultBranch)} · exact GitHub default-branch head</small></article>
      <article class="detail-card"><span>Open Pull Requests</span><strong>${project.openPullRequests.length}</strong><small>${project.openPullRequests.length ? project.openPullRequests.map((pr) => `#${pr.number} ${pr.title}`).join(' · ') : 'No open pull request'}</small></article>
      <article class="detail-card"><span>CI Facts</span><strong>${esc(ciSummary(project.ci))}</strong><small>No AICC PASS/FAIL inference</small></article>
      <article class="detail-card"><span>Roadmap</span><strong>${esc(project.roadmap?.title || 'Not registered')}</strong><small class="mono">${esc(project.roadmap?.path || '—')}</small></article>
    </section>
    <section class="source-panel">
      <div><p class="eyebrow">GITHUB PROVENANCE</p><h2>事实来源</h2></div>
      <dl><div><dt>Repository</dt><dd>${esc(project.repository)}</dd></div><div><dt>Ref</dt><dd class="mono">${esc(project.provenance.ref)}</dd></div><div><dt>Refreshed</dt><dd>${esc(project.provenance.refreshedAt)}</dd></div></dl>
    </section>`;
}

function render() {
  renderSwitcher();
  if (state.loading) {
    main.innerHTML = '<section class="loading-state"><div class="spinner"></div><h1>正在读取 GitHub 项目事实</h1><p>不会读取本地 branch 作为项目权威。</p></section>';
    statusbar.textContent = 'GitHub source · refreshing…';
    return;
  }
  if (state.error) {
    main.innerHTML = `<section class="empty-state"><span class="error-pill">ERROR</span><h1>GitHub 项目事实读取失败</h1><p>${esc(state.error)}</p></section>`;
    statusbar.textContent = 'GitHub source · refresh failed';
    return;
  }
  const selected = state.viewProjectId === 'all' ? null : projectById(state.viewProjectId);
  if (state.viewProjectId !== 'all' && !selected) state.viewProjectId = 'all';
  state.viewProjectId === 'all' ? renderAllProjects() : renderProject(selected);
  const latest = state.projects.map((project) => project.provenance?.refreshedAt).filter(Boolean).sort().at(-1);
  statusbar.textContent = `GitHub source · ${state.projects.length} project views · synced ${latest || 'unknown'}`;
}

function setView(projectId) {
  state.viewProjectId = projectId;
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

switcherButton.addEventListener('click', () => {
  switcherMenu.hidden = !switcherMenu.hidden;
  switcherButton.setAttribute('aria-expanded', String(!switcherMenu.hidden));
});
document.addEventListener('click', (event) => { if (!switcher.contains(event.target)) { switcherMenu.hidden = true; switcherButton.setAttribute('aria-expanded', 'false'); } });
refreshButton.addEventListener('click', refresh);
refresh();
