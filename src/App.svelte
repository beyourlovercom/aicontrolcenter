<script lang="ts">
  import { onMount } from 'svelte';
  import { agents } from './lib/data';
  import { cancelSync as cancelledSync, emptyState, loadControlLoop, requestSync, syncAllowed, syncOutcome, syncWorkspace, type ControlLoopState, type RoadmapEntry, type SyncState } from './lib/controlLoop';

  type Tab = 'overview' | 'openspec' | 'agents' | 'validation';

  type WorkItem = RoadmapEntry & { key: string; summary: string; gate: string; progress: string; progressPercent: number; parent: string; dependency: string; change: string; path: string; spec: string; task: string; run: string; criteria: string[] };
  let selected: WorkItem = { key: 'loading', id: 'LOADING', title: 'Loading formal roadmap', summary: 'Reading repository evidence.', status: 'CURRENT', authorization: 'CHECKING', gate: 'CHECKING', progress: '0 / 0', progressPercent: 0, parent: 'Living Roadmap', dependency: 'none', change: 'unknown', path: 'docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md', spec: 'unknown', task: 'unknown', run: 'unknown', criteria: [] };
  let activeTab: Tab = 'overview';
  let query = '';
  let refreshing = false;
  let toast = '';
  let controlLoop: ControlLoopState = emptyState;
  let syncState: SyncState = { kind: 'idle' };

  const evidence = [
    ['C', 'Project Charter', 'docs/00_Governance/01_PROJECT_CHARTER.md'],
    ['R', 'Living Roadmap', 'docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md'],
    ['W', 'Current Work Package', 'docs/60_Operations/work-packages/AICC-POST-MERGE-UAT-001.md'],
    ['P', 'OpenSpec Proposal', 'openspec/changes/aicc-visible-slice-001/proposal.md'],
    ['T', 'OpenSpec Tasks', 'openspec/changes/aicc-visible-slice-001/tasks.md'],
    ['OM', 'OmO Slim Config', '.opencode/oh-my-opencode-slim.json']
  ];

  $: formalItems = (controlLoop.roadmap?.entries ?? []).map((entry) => ({
    ...entry,
    key: entry.id,
    summary: `${entry.status} / ${entry.authorization}`,
    gate: entry.status,
    progress: `${entry.status}`,
    progressPercent: entry.status === 'CLOSED' ? 100 : entry.id === controlLoop.roadmap?.currentWorkPackage ? controlLoop.roadmap?.progressPercent ?? 0 : 0,
    parent: controlLoop.roadmap?.currentMilestone ?? 'Living Roadmap',
    dependency: 'Formal Work Package evidence',
    change: entry.id.toLowerCase(),
    path: `docs/60_Operations/work-packages/${entry.id}.md`,
    spec: 'formal', task: 'formal', run: 'read-only', criteria: []
  } satisfies WorkItem));
  $: filteredRoadmap = formalItems.filter((item) => {
    const needle = query.trim().toLowerCase();
    return !needle || `${item.id} ${item.title} ${item.summary}`.toLowerCase().includes(needle);
  });
  $: if (selected.key === 'loading') {
    const current = formalItems.find((item) => item.id === controlLoop.roadmap?.currentWorkPackage);
    if (current) selected = current;
  }

  function choose(item: WorkItem) {
    selected = item;
  }

  function announce(message: string) {
    toast = message;
    window.setTimeout(() => {
      if (toast === message) toast = '';
    }, 1900);
  }

  async function refresh() {
    refreshing = true;
    controlLoop = await loadControlLoop();
    refreshing = false;
    announce(controlLoop.status === 'VERIFIED' ? 'Remote Authority 已验证；未执行 fetch。' : `Authority 状态：${controlLoop.status}`);
  }

  async function syncLocalMain() {
    if (!syncAllowed(controlLoop.evaluation)) return;
    syncState = requestSync(controlLoop.evaluation);
  }

  function cancelSync() {
    syncState = cancelledSync();
  }

  async function confirmSync() {
    syncState = { kind: 'loading' };
    try {
      const result = await syncWorkspace();
      syncState = syncOutcome(result);
      if (!result.success) return;
      await refresh();
    } catch (error) {
      syncState = { kind: 'failure', message: `同步被阻止：${error instanceof Error ? error.message : String(error)}` };
    }
  }

  onMount(refresh);
</script>

<div class="app-shell">
  <header class="topbar">
    <div class="brand-cell">
      <div class="brand-mark">✓</div>
      <div>
        <div class="brand-name">AI Control Center</div>
        <div class="brand-subtitle">Authority · OpenSpec · OmO Slim</div>
      </div>
    </div>

    <div class="search-cell">
      <label class="search-box">
        <span class="search-icon">⌕</span>
        <input bind:value={query} type="search" placeholder="搜索 Roadmap、Work Package、Change" aria-label="搜索 Roadmap、Work Package、Change" />
      </label>
    </div>

    <div class="authority-cell">
      <div>
        <div class="micro-label">Remote Authority</div>
        <div class="authority-value">origin/main · {controlLoop.status}</div>
      </div>
      <button class="primary-button" type="button" onclick={refresh}>{refreshing ? '验证中…' : '刷新状态'}</button>
    </div>
  </header>

  <div class="workspace">
    <aside class="roadmap-pane">
      <div class="pane-heading">
        <div class="eyebrow">Project Roadmap</div>
        <div class="heading-row">
          <h2>{controlLoop.roadmap?.currentMilestone ?? 'Living Roadmap'}</h2>
          <span class="accent-chip">{controlLoop.roadmap?.progressPercent ?? 0}%</span>
        </div>
        <p>正式 Roadmap / Work Package evidence · 当前：{controlLoop.roadmap?.currentWorkPackage ?? 'CHECKING'}</p>
      </div>

      <div class="roadmap-scroll">
        {#each filteredRoadmap as item}
          <button class:active={selected.key === item.key} class="work-row" type="button" onclick={() => choose(item)}>
            <span class="node-icon">{item.id.slice(-3)}</span>
            <span class="tree-copy">
              <span class="tree-name">{item.title}</span>
              <span class="tree-code">{item.id}</span>
              <span class="mini-metrics"><span>{item.status}</span><span>{item.authorization}</span></span>
            </span>
            <span class:done={item.status === 'CLOSED'} class:current={item.id === controlLoop.roadmap?.currentWorkPackage} class="status-dot"></span>
          </button>
        {/each}
      </div>

      <div class="security-area">
        <div class="security-card">
          <div class="security-label">CURRENT SECURITY MODE</div>
          <strong>Read-only V1</strong>
          <p>OpenSpec 只解析；OmO Slim 只读取配置；Agent、Apply 与仓库写入全部禁用。</p>
        </div>
      </div>
    </aside>

    <main class="detail-pane" aria-live="polite">
      <div class="detail-hero">
        <div>
          <div class="eyebrow">{selected.id}</div>
          <h1>{selected.title}</h1>
          <p>{selected.summary}</p>
        </div>
        <button class="primary-button" type="button" onclick={() => announce(`原型操作：打开 ${selected.id}`)}>打开正式 WP</button>
      </div>

      <nav class="tabs" aria-label="Work Package details">
        {#each [['overview', 'Overview'], ['openspec', 'OpenSpec'], ['agents', 'Agents'], ['validation', 'Validation']] as tab}
          <button class:active={activeTab === tab[0]} type="button" onclick={() => activeTab = tab[0] as Tab}>{tab[1]}</button>
        {/each}
      </nav>

      {#if activeTab === 'overview'}
        <section class="tab-panel">
          <div class="metric-grid">
            <article class="metric-card">
              <div class="eyebrow">Authority</div>
              <div class="metric-value">{controlLoop.status}</div>
              <div class="metric-note mono">origin/main · {controlLoop.authority?.remoteMainSha ?? 'unknown'}</div>
            </article>
            <article class="metric-card">
              <div class="eyebrow">Current Gate</div>
              <div class="metric-value">{selected.gate}</div>
              <div class="metric-note">{selected.authorization}</div>
            </article>
            <article class="metric-card">
              <div class="eyebrow">Progress</div>
              <div class="metric-value">{controlLoop.roadmap?.progressPercent ?? 0}%</div>
              <div class="progress-track"><span style={`width:${controlLoop.roadmap?.progressPercent ?? 0}%`}></span></div>
            </article>
          </div>

          <article class="content-card">
            <div class="section-title-row"><h3>Formal Contract</h3><span class="accent-chip">{selected.status}</span></div>
            <dl class="contract-grid">
              <div><dt>正式文件</dt><dd class="mono">{selected.path}</dd></div>
              <div><dt>授权状态</dt><dd>{selected.authorization}</dd></div>
              <div><dt>Current Milestone</dt><dd>{controlLoop.roadmap?.currentMilestone ?? selected.parent}</dd></div>
              <div><dt>Roadmap Authority</dt><dd class="mono">{controlLoop.roadmap?.authoritySha ?? 'unknown'}</dd></div>
              <div><dt>Next Work Packages</dt><dd>{controlLoop.roadmap?.nextWorkPackages.join(', ') ?? 'unknown'}</dd></div>
              <div><dt>远端策略</dt><dd>只读查询 remote main，不执行 git fetch</dd></div>
            </dl>
          </article>

          <article class="content-card">
            <div class="section-title-row"><h3>Workspace Sync Evaluation</h3><span class:allow={syncAllowed(controlLoop.evaluation)} class="accent-chip">{syncAllowed(controlLoop.evaluation) ? 'ALLOWED' : 'BLOCKED'}</span></div>
            <dl class="contract-grid">
              <div><dt>Remote Main SHA</dt><dd class="mono">{controlLoop.authority?.remoteMainSha ?? 'unknown'}</dd></div>
              <div><dt>Local Main SHA</dt><dd class="mono">{controlLoop.identity?.localMainSha ?? 'unknown'}</dd></div>
              <div><dt>Current Branch</dt><dd>{controlLoop.identity?.currentBranch ?? 'detached / unknown'}</dd></div>
              <div><dt>Current HEAD</dt><dd class="mono">{controlLoop.identity?.localHead ?? 'unknown'}</dd></div>
              <div><dt>Worktree</dt><dd>{controlLoop.identity?.worktreeClean ? 'CLEAN' : 'DIRTY'}</dd></div>
              <div><dt>Checked At</dt><dd>{controlLoop.authority?.checkedAt ?? 'not checked'}</dd></div>
            </dl>
            <div class="criteria-grid">
              {#each controlLoop.evaluation?.blockers ?? ['CHECKING'] as blocker}
                <div class="criterion"><b>!</b><span>{blocker}</span></div>
              {/each}
            </div>
            <button class="primary-button" type="button" disabled={!syncAllowed(controlLoop.evaluation) || syncState.kind === 'loading'} onclick={syncLocalMain}>同步本地 main</button>
            {#if syncState.kind === 'confirming'}
              <div class="confirm-box" role="dialog" aria-label="确认同步">
                <strong>确认同步本地 main？</strong>
                <span>仅执行固定 fetch → revalidate → switch → ff-only merge。</span>
                <div class="confirm-actions">
                  <button class="secondary-button" type="button" onclick={cancelSync}>取消</button>
                  <button class="primary-button" type="button" onclick={confirmSync}>确认同步</button>
                </div>
              </div>
            {:else if syncState.kind === 'loading'}
              <div class="sync-status" role="status">同步中…</div>
            {:else if syncState.kind === 'success' || syncState.kind === 'failure' || syncState.kind === 'cancelled'}
              <div class:success={syncState.kind === 'success'} class:failure={syncState.kind === 'failure'} class="sync-status" role="status">{syncState.message}</div>
            {/if}
          </article>

          <article class="content-card">
            <div class="section-title-row"><h3>Next Authorized Work Package</h3><span class="accent-chip">{controlLoop.resolver?.decision ?? 'UNKNOWN'}</span></div>
            {#if controlLoop.resolver?.workPackage}
              <dl class="contract-grid">
                <div><dt>WP ID</dt><dd class="mono">{controlLoop.resolver.workPackage.id}</dd></div>
                <div><dt>Title</dt><dd>{controlLoop.resolver.workPackage.title}</dd></div>
                <div><dt>Authority SHA</dt><dd class="mono">{controlLoop.resolver.workPackage.authoritySha}</dd></div>
                <div><dt>OpenSpec Change</dt><dd class="mono">{controlLoop.resolver.workPackage.openspecChange}</dd></div>
                <div><dt>Dependencies</dt><dd>{controlLoop.resolver.workPackage.dependencies.map((dependency) => `${dependency.id}=${dependency.status}`).join(', ')}</dd></div>
              </dl>
            {/if}
            <div class="criteria-grid">
              {#each controlLoop.resolver?.blockers ?? ['UNKNOWN'] as blocker}
                <div class="criterion"><b>!</b><span>{blocker}</span></div>
              {/each}
            </div>
          </article>

          <article class="content-card">
            <div class="section-title-row"><h3>Formal Roadmap State</h3><span class="secondary-note">{controlLoop.roadmap?.entries.length ?? 0} packages</span></div>
            <div class="criteria-grid">
              {#each controlLoop.roadmap?.entries ?? [] as item, index}
                <div class="criterion"><b>{String(index + 1).padStart(2, '0')}</b><span>{item.id}: {item.status} / {item.authorization}</span></div>
              {/each}
            </div>
          </article>
        </section>
      {:else if activeTab === 'openspec'}
        <section class="tab-panel">
          <article class="content-card no-top-margin">
            <div class="section-title-row">
              <div><h3>OpenSpec Artifact Graph</h3><span class="secondary-note mono">Change: {selected.change}</span></div>
              <span class="accent-chip">READ ONLY</span>
            </div>
            <div class="artifact-grid">
              {#each [['01','Proposal','COMPLETE'],['02','Specs','COMPLETE'],['03','Design','COMPLETE'],['04','Tasks',selected.task],['05','Validation','NOT STARTED']] as artifact, index}
                <div class:ready={index < 3} class:current={index === 3} class="artifact-card">
                  <div class="eyebrow">{artifact[0]}</div>
                  <strong>{artifact[1]}</strong>
                  <span>{artifact[2]}</span>
                </div>
              {/each}
            </div>
          </article>

          <article class="content-card">
            <div class="section-title-row"><h3>OpenSpec Action Policy</h3><span class="secondary-note">V1 and future gates</span></div>
            <div class="policy-row"><span>读取 Artifacts</span><b class="allow">ALLOW</b></div>
            <div class="policy-row"><span>Explore / Propose / Update / Verify</span><b class="future">FUTURE GOVERNED ACTION</b></div>
            <div class="policy-row"><span>Apply</span><b class="deny">OWNER AUTHORIZATION REQUIRED</b></div>
            <div class="policy-row"><span>Sync</span><b class="deny">PERMANENT DENY</b></div>
            <div class="policy-row"><span>Archive</span><b class="deny">OWNER CLOSURE ONLY</b></div>
          </article>
        </section>
      {:else if activeTab === 'agents'}
        <section class="tab-panel">
          <div class="metric-grid">
            <article class="metric-card"><div class="eyebrow">OmO Slim</div><div class="metric-value">DETECTED</div><div class="metric-note">Configuration view</div></article>
            <article class="metric-card"><div class="eyebrow">Active Preset</div><div class="metric-value">PROJECT CONFIG</div><div class="metric-note">7 configured agents</div></article>
            <article class="metric-card"><div class="eyebrow">Runtime</div><div class="metric-value">OFF</div><div class="metric-note">No session · no writer lock</div></article>
          </div>

          <article class="content-card">
            <div class="section-title-row"><h3>OmO Slim Agent Team</h3><span class="accent-chip">CONFIG VIEW</span></div>
            <div class="agent-grid">
              {#each agents as agent}
                <div class="agent-card">
                  <div class="agent-top"><span class="agent-avatar">{agent[0]}</span><div><strong>{agent[1]}</strong><span>{agent[2]}</span></div></div>
                  <div class="agent-tags"><span>{agent[3]}</span><span>{agent[4]}</span></div>
                </div>
              {/each}
            </div>
          </article>

          <div class="callout"><strong>Capability-based Policy：</strong>只读工具调用可进入并行 Read Lanes；任何可能修改仓库的工具调用，无论由哪个 Agent 发起，都必须进入唯一 Write Lane 并先取得 Writer Lock。当前 V1 全部 Agent 关闭。</div>
        </section>
      {:else}
        <section class="tab-panel">
          <article class="content-card no-top-margin">
            <div class="section-title-row"><h3>Controlled Validation Pipeline</h3><span class="accent-chip">NO ACTIVE RUN</span></div>
            <div class="pipeline">
              {#each [
                ['01','Authority Gate','Remote main and formal WP verified','PASS','pass'],
                ['02','OpenSpec Parse','Artifacts and task graph detected','PASS','pass'],
                ['03','Owner Authorization','Required before Apply or runtime','WAITING','wait'],
                ['04','OmO Delegation Plan','Parallel reads, single write lane','LOCKED','locked'],
                ['05','Implementation and Tests','Disabled in read-only V1','LOCKED','locked'],
                ['06','Independent Review','Separate evidence contract','LOCKED','locked'],
                ['07','Owner Handoff','Stops at WAITING_OWNER_ACCEPTANCE','LOCKED','locked']
              ] as step}
                <div class="pipeline-step">
                  <span class="step-number">{step[0]}</span>
                  <div><strong>{step[1]}</strong><span>{step[2]}</span></div>
                  <b class={step[4]}>{step[3]}</b>
                </div>
              {/each}
            </div>
          </article>
        </section>
      {/if}
    </main>

    <aside class="evidence-pane">
      <div class="section-title-row">
        <div><div class="eyebrow">Repository Status</div><h3>Authority Health</h3></div>
        <span class="accent-chip">100%</span>
      </div>

      <div class="health-card">
        <div><span>Local HEAD</span><b class="mono">20d1c9d</b></div>
        <div><span>Remote main</span><b class="mono">20d1c9d</b></div>
        <div><span>Formal WP</span><b class="allow">MATCHED</b></div>
        <div><span>Authority Drift</span><b class="allow">NONE</b></div>
        <div><span>Owner Gate</span><b class="future">PLANNING</b></div>
      </div>

      <div class="section-title-row stack-heading"><h3>Execution Stack</h3><span class="secondary-note">Read-only probe</span></div>
      <div class="stack-list">
        {#each [['OS','OpenSpec','Artifacts parsed','DETECTED'],['OM','OmO Slim','Preset and agents parsed','DETECTED'],['OC','OpenCode','Runtime not started','AVAILABLE'],['RN','Active Run','No bound session','NONE'],['WL','Writer Lock','Write lane disabled','NOT HELD']] as item}
          <div class="stack-row"><span class="stack-icon">{item[0]}</span><div><strong>{item[1]}</strong><span>{item[2]}</span></div><b>{item[3]}</b></div>
        {/each}
      </div>

      <div class="section-title-row stack-heading"><h3>Formal Evidence</h3><span class="secondary-note">Read-only sources</span></div>
      <div class="evidence-list">
        {#each evidence as file}
          <button type="button" onclick={() => announce(`原型操作：打开 ${file[1]}`)}>
            <span class="stack-icon">{file[0]}</span>
            <span><strong>{file[1]}</strong><small>{file[1] === 'Current Work Package' ? 'docs/60_Operations/work-packages/AICC-POST-MERGE-UAT-001.md' : file[2]}</small></span>
            <b>›</b>
          </button>
        {/each}
      </div>

      <div class="callout compact"><strong>Authority first：</strong>OpenSpec、OmO Slim 和 Runtime 无权改变正式授权；发生冲突时停止并显示 AUTHORITY_DRIFT。</div>
    </aside>
  </div>

  {#if toast}<div class="toast" role="status">{toast}</div>{/if}
</div>
