<script lang="ts">
  import { onMount } from 'svelte';
  import { cancelSync as cancelledSync, authorizeWorkPackage, controlCodex, emptyState, loadControlLoop, ownerBlocker, repositoryStatusEvidence, requestSync, runtimePhaseCopy, runtimeSupportsControl, syncAllowed, syncOutcome, syncState as getSyncState, syncWorkspace, type CodexControlAction, type ControlLoopState, type RoadmapEntry, type SyncState } from './lib/controlLoop';

  type Tab = 'overview' | 'openspec' | 'codex' | 'validation';

  type WorkItem = RoadmapEntry & { key: string; summary: string; gate: string; progress: string; progressPercent: number; parent: string; dependency: string; change: string; path: string; spec: string; task: string; run: string; criteria: string[] };
  let selected: WorkItem = { key: 'loading', id: 'LOADING', title: '正在读取正式路线图', summary: '正在读取仓库证据。', status: 'CURRENT', authorization: 'CHECKING', gate: 'CHECKING', progress: '0 / 0', progressPercent: 0, parent: '项目路线图', dependency: 'unknown', change: 'unknown', path: 'docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md', spec: 'unknown', task: 'unknown', run: 'unknown', criteria: [] };
  let activeTab: Tab = 'overview';
  let query = '';
  let refreshing = false;
  let toast = '';
  let controlLoop: ControlLoopState = emptyState;
  let syncState: SyncState = { kind: 'idle' };
  let authorizationConfirming = false;
  let controlPending = false;
  $: syncCode = controlLoop.evaluation?.blockers[0] ?? getSyncState(controlLoop.evaluation);
  $: syncCopy = ownerBlocker(syncCode);
  $: repositoryStatus = repositoryStatusEvidence(controlLoop);
  $: codexRuntime = controlLoop.codexRuntime;

  const evidence = [
    ['C', '项目章程 Project Charter', 'docs/00_Governance/01_PROJECT_CHARTER.md'],
    ['R', '在用路线图 Living Roadmap', 'docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md'],
    ['W', '当前工作包 Current Work Package', 'docs/60_Operations/work-packages/AICC-CODEX-ONLY-MIGRATION-001.md'],
    ['P', 'OpenSpec 提案 Proposal', 'openspec/changes/aicc-visible-slice-001/proposal.md'],
    ['T', 'OpenSpec 任务 Tasks', 'openspec/changes/aicc-visible-slice-001/tasks.md'],
    ['CX', 'Codex App Server 配置 Config', 'Codex profile: sol']
  ];

  $: formalItems = (controlLoop.roadmap?.entries ?? []).map((entry) => ({
    ...entry,
    key: entry.id,
    summary: `${entry.status} / ${entry.authorization}`,
    gate: entry.status,
    progress: `${entry.status}`,
    progressPercent: entry.status === 'CLOSED' ? 100 : 0,
    parent: entry.milestone ?? 'UNASSIGNED',
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
    announce(controlLoop.status === 'VERIFIED' ? '远端 Authority 已验证；未执行 fetch。' : `Authority 状态：${controlLoop.status}`);
  }

  function requestAuthorization() {
    authorizationConfirming = true;
  }

  function cancelAuthorization() {
    authorizationConfirming = false;
  }

  async function confirmAuthorization() {
    const workPackageId = controlLoop.roadmap?.currentWorkPackage;
    if (!workPackageId) return;
    try {
      controlLoop = { ...controlLoop, authorization: await authorizeWorkPackage(workPackageId, true) };
      authorizationConfirming = false;
      await refresh();
    } catch (error) {
      authorizationConfirming = false;
      announce(`授权被阻止：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function runCodexControl(action: CodexControlAction) {
    if (controlPending) return;
    controlPending = true;
    try {
      controlLoop = { ...controlLoop, codexRuntime: await controlCodex(action) };
    } catch (error) {
      announce(`Codex 操作被阻止：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      controlPending = false;
    }
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
        <div class="brand-subtitle">Authority · OpenSpec · Codex App Server</div>
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
        <div class="micro-label">远端 Authority</div>
        <div class="authority-value">origin/main · {controlLoop.status}</div>
      </div>
      <button class="primary-button" type="button" onclick={refresh}>{refreshing ? '验证中…' : '刷新状态'}</button>
    </div>
  </header>

  <div class="workspace">
    <aside class="roadmap-pane">
      <div class="pane-heading">
        <div class="eyebrow">项目路线图</div>
        <div class="heading-row">
          <h2>{controlLoop.roadmap?.project ?? 'AI Control Center'}</h2>
          <span class="accent-chip">{controlLoop.roadmap?.progressPercent ?? 0}%</span>
        </div>
        <p>项目 → 里程碑 → 工作包 · 当前：{controlLoop.roadmap?.currentMilestone ?? 'CHECKING'}</p>
      </div>

      <div class="roadmap-scroll">
        {#each controlLoop.roadmap?.milestones ?? [] as milestone}
          <div class="milestone-summary"><strong>{milestone.id} — {milestone.title}</strong><b>{milestone.progressPercent}%</b></div>
          {#each filteredRoadmap.filter((item) => item.parent === milestone.id) as item}
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
          {#each milestone.futureItems.filter((item) => item.toLowerCase().includes(query.trim().toLowerCase())) as futureItem}
            <div class="future-work-row" data-kind="future-placeholder">
              <span class="future-node">○</span>
              <span class="tree-copy">
                <span class="tree-name">{futureItem}</span>
                <span class="tree-code">未来规划 / 尚未正式化</span>
              </span>
            </div>
          {/each}
        {/each}
      </div>

      <div class="security-area">
        <div class="security-card">
          <div class="security-label">当前安全模式</div>
          <strong>只读 V1</strong>
          <p>OpenSpec 只解析；Codex 仅在 Owner 授权和固定能力范围内运行；任意 shell、越权写入和自动授权全部禁用。</p>
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
        {#if controlLoop.authorization?.valid}
          <span class="accent-chip">AUTHORIZED_FOR_IMPLEMENTATION</span>
        {:else}
          <button class="primary-button" type="button" onclick={requestAuthorization}>授权本工作包</button>
        {/if}
      </div>

      {#if authorizationConfirming}
        <div class="confirm-box authorization-box" role="dialog" aria-label="确认工作包授权">
          <strong>确认授权本工作包？</strong>
          <span>授权将绑定 Work Package ID、Authority SHA、当前分支、工作区、范围、允许/禁止能力与时间戳。不会启动 Codex。</span>
          <div class="confirm-actions">
            <button class="secondary-button" type="button" onclick={cancelAuthorization}>取消</button>
            <button class="primary-button" type="button" onclick={confirmAuthorization}>确认授权</button>
          </div>
        </div>
      {/if}

      <nav class="tabs" aria-label="工作包详情">
        {#each [['overview', '概览'], ['openspec', 'OpenSpec'], ['codex', 'Codex 状态'], ['validation', '验证']] as tab}
          <button class:active={activeTab === tab[0]} type="button" onclick={() => activeTab = tab[0] as Tab}>{tab[1]}</button>
        {/each}
      </nav>

      {#if activeTab === 'overview'}
        <section class="tab-panel">
          <div class="metric-grid">
            <article class="metric-card">
              <div class="eyebrow">正式 Authority</div>
              <div class="metric-value">{controlLoop.status}</div>
              <div class="metric-note mono">origin/main · {controlLoop.authority?.remoteMainSha ?? 'unknown'}</div>
            </article>
            <article class="metric-card">
              <div class="eyebrow">当前关卡</div>
              <div class="metric-value">{selected.gate}</div>
              <div class="metric-note">{selected.authorization}</div>
            </article>
            <article class="metric-card">
              <div class="eyebrow">全局进度</div>
              <div class="metric-value">{controlLoop.roadmap?.progressPercent ?? 0}%</div>
              <div class="progress-track"><span style={`width:${controlLoop.roadmap?.progressPercent ?? 0}%`}></span></div>
            </article>
          </div>

          <article class="content-card">
            <div class="section-title-row"><h3>正式合同</h3><span class="accent-chip">{selected.status}</span></div>
            <dl class="contract-grid">
              <div><dt>正式文件</dt><dd class="mono">{selected.path}</dd></div>
              <div><dt>授权状态</dt><dd>{selected.authorization}</dd></div>
              <div><dt>当前里程碑</dt><dd>{controlLoop.roadmap?.currentMilestone ?? selected.parent}</dd></div>
              <div><dt>路线图 Authority</dt><dd class="mono">{controlLoop.roadmap?.authoritySha ?? 'unknown'}</dd></div>
              <div><dt>后续工作包</dt><dd>{controlLoop.roadmap?.nextWorkPackages.join(', ') ?? 'unknown'}</dd></div>
              <div><dt>远端策略</dt><dd>只读查询 remote main，不执行 git fetch</dd></div>
            </dl>
          </article>

          <article class="content-card">
            <div class="section-title-row"><h3>Owner 授权证据</h3><span class="accent-chip">{controlLoop.authorization?.status ?? 'UNKNOWN'}</span></div>
            <dl class="contract-grid">
              <div><dt>Work Package</dt><dd class="mono">{controlLoop.authorization?.record?.workPackageId ?? 'UNKNOWN'}</dd></div>
              <div><dt>Authority SHA</dt><dd class="mono">{controlLoop.authorization?.record?.authoritySha ?? 'UNKNOWN'}</dd></div>
              <div><dt>分支</dt><dd>{controlLoop.authorization?.record?.branch ?? 'UNKNOWN'}</dd></div>
              <div><dt>工作区</dt><dd class="mono">{controlLoop.authorization?.record?.worktree ?? 'UNKNOWN'}</dd></div>
              <div><dt>范围</dt><dd>{controlLoop.authorization?.record?.scope ?? 'UNKNOWN'}</dd></div>
              <div><dt>允许能力</dt><dd class="mono">{controlLoop.authorization?.record?.allowedCapabilities.join(', ') ?? 'UNKNOWN'}</dd></div>
              <div><dt>禁止能力</dt><dd class="mono">{controlLoop.authorization?.record?.forbiddenCapabilities.join(', ') ?? 'UNKNOWN'}</dd></div>
              <div><dt>授权时间</dt><dd>{controlLoop.authorization?.record?.authorizedAt ?? 'UNKNOWN'}</dd></div>
            </dl>
            {#if controlLoop.authorization?.blocker}<div class="sync-status failure" role="status">{controlLoop.authorization.blocker}</div>{/if}
          </article>

          <article class="content-card">
            <div class="section-title-row"><h3>本地 main 同步状态</h3><span class="accent-chip">{getSyncState(controlLoop.evaluation)}</span></div>
            <div class="sync-explanation"><strong>{syncCopy.reason}</strong><span class="mono">{syncCode}</span><small>下一步：{syncCopy.nextStep}</small></div>
            <dl class="contract-grid">
              <div><dt>远端 Main SHA</dt><dd class="mono">{controlLoop.authority?.remoteMainSha ?? 'unknown'}</dd></div>
              <div><dt>本地 Main SHA</dt><dd class="mono">{controlLoop.identity?.localMainSha ?? 'unknown'}</dd></div>
              <div><dt>当前分支</dt><dd>{controlLoop.identity?.currentBranch ?? 'detached / unknown'}</dd></div>
              <div><dt>当前 HEAD</dt><dd class="mono">{controlLoop.identity?.localHead ?? 'unknown'}</dd></div>
              <div><dt>工作区</dt><dd>{controlLoop.identity?.worktreeClean ? 'CLEAN' : 'DIRTY'}</dd></div>
              <div><dt>检查时间</dt><dd>{controlLoop.authority?.checkedAt ?? 'not checked'}</dd></div>
            </dl>
            <div class="criteria-grid">
              {#each controlLoop.evaluation?.blockers ?? ['CHECKING'] as blocker}
                <div class="criterion"><b>!</b><span>{ownerBlocker(blocker).reason}<small class="mono">{blocker}</small></span></div>
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
            <div class="section-title-row"><h3>下一工作包执行判定</h3><span class="accent-chip">后续工作包关卡</span></div>
            <div class="resolver-summary"><strong>当前候选工作包</strong><span>{controlLoop.resolver?.workPackage?.id ?? '暂无候选工作包'}</span><strong>执行</strong><span>{controlLoop.resolver?.decision ?? 'UNKNOWN'}</span></div>
            {#if controlLoop.resolver?.workPackage}
              <dl class="contract-grid">
                <div><dt>WP ID</dt><dd class="mono">{controlLoop.resolver.workPackage.id}</dd></div>
                <div><dt>标题</dt><dd>{controlLoop.resolver.workPackage.title}</dd></div>
                <div><dt>Authority SHA</dt><dd class="mono">{controlLoop.resolver.workPackage.authoritySha}</dd></div>
                <div><dt>OpenSpec 变更</dt><dd class="mono">{controlLoop.resolver.workPackage.openspecChange}</dd></div>
                <div><dt>依赖关系</dt><dd>{controlLoop.resolver.workPackage.dependencies.map((dependency) => `${dependency.id}=${dependency.status}`).join(', ')}</dd></div>
              </dl>
            {/if}
            <div class="criteria-grid">
              {#each controlLoop.resolver?.blockers ?? ['UNKNOWN'] as blocker}
                <div class="criterion"><b>!</b><span>{blocker === 'WORK_PACKAGE_NOT_AUTHORIZED' ? '等待 Owner 授权' : '存在执行阻塞'}<small class="mono">{blocker}</small><small>下一步：完成当前 Post-UAT Closure / Owner Authorization</small></span></div>
              {/each}
            </div>
          </article>

          <article class="content-card">
            <div class="section-title-row"><h3>正式路线图证据</h3><span class="secondary-note">{controlLoop.roadmap?.entries.length ?? 0} 个工作包</span></div>
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
              <div><h3>OpenSpec 工件图</h3><span class="secondary-note mono">Change: {selected.change}</span></div>
              <span class="accent-chip">只读</span>
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
            <div class="section-title-row"><h3>OpenSpec 操作策略</h3><span class="secondary-note">V1 与未来关卡</span></div>
            <div class="policy-row"><span>读取 Artifacts</span><b class="allow">ALLOW</b></div>
            <div class="policy-row"><span>Explore / Propose / Update / Verify</span><b class="future">FUTURE GOVERNED ACTION</b></div>
            <div class="policy-row"><span>Apply</span><b class="deny">OWNER AUTHORIZATION REQUIRED</b></div>
            <div class="policy-row"><span>Sync</span><b class="deny">PERMANENT DENY</b></div>
            <div class="policy-row"><span>Archive</span><b class="deny">OWNER CLOSURE ONLY</b></div>
          </article>
        </section>
      {:else if activeTab === 'codex'}
        <section class="tab-panel">
          <div class="metric-grid">
            <article class="metric-card"><div class="eyebrow">Codex 引擎</div><div class="metric-value">{codexRuntime?.engine ?? 'UNKNOWN'}</div><div class="metric-note">profile: {codexRuntime?.profile ?? 'UNKNOWN'}</div></article>
            <article class="metric-card"><div class="eyebrow">当前运行状态</div><div class="metric-value">{codexRuntime ? runtimePhaseCopy(codexRuntime.currentPhase) : '未知'}</div><div class="metric-note mono">{codexRuntime?.currentPhase ?? 'UNKNOWN'}</div></article>
            <article class="metric-card"><div class="eyebrow">当前任务</div><div class="metric-value">{codexRuntime?.currentTask ?? 'UNKNOWN'}</div><div class="metric-note mono">{codexRuntime?.currentEvent ?? 'NO_OBSERVED_EVENT'}</div></article>
          </div>

          <article class="content-card">
            <div class="section-title-row"><h3>Codex 运行观察</h3><span class="accent-chip">{codexRuntime?.sessionState ?? 'UNKNOWN'}</span></div>
            <dl class="contract-grid">
              <div><dt>进程 PID</dt><dd class="mono">{codexRuntime?.processId ?? 'UNKNOWN'}</dd></div>
              <div><dt>进程状态</dt><dd class="mono">{codexRuntime?.processState ?? 'UNKNOWN'}</dd></div>
              <div><dt>Session</dt><dd class="mono">{codexRuntime?.sessionId ?? 'UNKNOWN'}</dd></div>
              <div><dt>Thread</dt><dd class="mono">{codexRuntime?.threadId ?? 'UNKNOWN'}</dd></div>
              <div><dt>Turn</dt><dd class="mono">{codexRuntime?.turnId ?? 'UNKNOWN'}</dd></div>
              <div><dt>当前工作包</dt><dd class="mono">{codexRuntime?.activeWorkPackage ?? 'UNKNOWN'}</dd></div>
              <div><dt>分支</dt><dd>{codexRuntime?.branch ?? 'UNKNOWN'}</dd></div>
              <div><dt>工作区</dt><dd class="mono">{codexRuntime?.worktree ?? 'UNKNOWN'}</dd></div>
              <div><dt>最后活动</dt><dd>{codexRuntime?.lastActivity ?? 'UNKNOWN'}</dd></div>
              <div><dt>Writer Lock</dt><dd class="mono">{codexRuntime ? (codexRuntime.writerLockHeld ? 'HELD' : 'NOT_HELD') : 'UNKNOWN'}</dd></div>
              <div><dt>退出状态</dt><dd class="mono">{codexRuntime?.exitStatus ?? 'NOT_OBSERVED'}</dd></div>
              <div><dt>失败证据</dt><dd class="mono">{codexRuntime?.failure ?? 'NONE'}</dd></div>
              <div><dt>测试状态</dt><dd class="mono">{codexRuntime?.testState ?? 'UNKNOWN'}</dd></div>
              <div><dt>独立审查</dt><dd class="mono">{codexRuntime?.reviewState ?? 'UNKNOWN'}</dd></div>
              <div><dt>PR</dt><dd class="mono">{codexRuntime?.pullRequest ?? 'UNKNOWN'}</dd></div>
              <div><dt>CI 状态</dt><dd class="mono">{codexRuntime?.ciState ?? 'UNKNOWN'}</dd></div>
              <div><dt>阻塞</dt><dd class="mono">{codexRuntime?.blocker ?? 'NONE'}</dd></div>
              <div><dt>下一步</dt><dd>{codexRuntime?.nextAction ?? 'UNKNOWN'}</dd></div>
            </dl>
            <div class="runtime-controls">
              {#each [['START','启动 Codex'],['PAUSE','暂停'],['RESUME','恢复'],['STOP_AFTER_CURRENT_STEP','当前步骤后停止'],['RETRY','重试']] as action}
                <button class="secondary-button" type="button" title={runtimeSupportsControl(codexRuntime, action[0] as CodexControlAction) ? '' : 'UNSUPPORTED_CONTROL'} disabled={controlPending || !runtimeSupportsControl(codexRuntime, action[0] as CodexControlAction)} onclick={() => runCodexControl(action[0] as CodexControlAction)}>{action[1]}{runtimeSupportsControl(codexRuntime, action[0] as CodexControlAction) ? '' : '（不支持）'}</button>
              {/each}
            </div>
          </article>

          <div class="callout"><strong>Codex 能力策略：</strong>Codex App Server 使用固定 profile `sol` 和预定义能力。Owner UI 不接受 shell 文本；任何仓库写入必须保持唯一 Writer Lock、范围绑定和独立审查。</div>
        </section>
      {:else}
        <section class="tab-panel">
          <article class="content-card no-top-margin">
            <div class="section-title-row"><h3>受控验证流程</h3><span class="accent-chip">{codexRuntime?.currentPhase ?? 'UNKNOWN'}</span></div>
            <div class="pipeline">
              {#each [
                ['01','Authority 关卡','远端 main 与正式 WP 已检查','PASS','pass'],
                ['02','OpenSpec 解析','工件与任务图已检测','PASS','pass'],
                ['03','Owner 授权','Apply 或 Runtime 前必须授权','WAITING','wait'],
                ['04','Codex 委派计划','并行读取，单一写入通道','LOCKED','locked'],
                ['05','实现与测试','只读 V1 中已禁用','LOCKED','locked'],
                ['06','独立审查','独立证据合同','LOCKED','locked'],
                ['07','Owner 交接','停止于 WAITING_OWNER_ACCEPTANCE','LOCKED','locked']
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
        <div><div class="eyebrow">仓库状态</div><h3>Authority 健康度</h3></div>
        <span class="accent-chip">{controlLoop.roadmap?.progressPercent ?? 0}%</span>
      </div>

      <div class="health-card">
        <div><span>本地 HEAD</span><b class="mono">{repositoryStatus.localHead}</b></div>
        <div><span>远端 main</span><b class="mono">{repositoryStatus.remoteMain}</b></div>
        <div><span>工作区</span><b class:allow={repositoryStatus.worktree === 'CLEAN'} class:deny={repositoryStatus.worktree === 'DIRTY'}>{repositoryStatus.worktree}</b></div>
        <div><span>Authority</span><b>{repositoryStatus.authority}</b></div>
        <div><span>当前工作包</span><b class="mono">{repositoryStatus.currentWorkPackage}</b></div>
        <div><span>后续工作包关卡</span><b>{repositoryStatus.nextWpGate}</b></div>
      </div>

      <div class="section-title-row stack-heading"><h3>执行状态</h3><span class="secondary-note">只读探测</span></div>
      <div class="stack-list">
        {#each [['OS','OpenSpec','已解析正式工件','DETECTED'],['CX','Codex App Server',`profile: ${codexRuntime?.profile ?? 'UNKNOWN'} · PID ${codexRuntime?.processId ?? 'UNKNOWN'}`,codexRuntime?.processState ?? 'UNKNOWN'],['RN','Codex Run',codexRuntime?.threadId ?? 'NO_OBSERVED_THREAD',codexRuntime?.currentPhase ?? 'UNKNOWN'],['WL','Writer Lock',codexRuntime?.activeWorkPackage ?? 'NO_ACTIVE_WORK_PACKAGE',codexRuntime ? (codexRuntime.writerLockHeld ? 'HELD' : 'NOT_HELD') : 'UNKNOWN']] as item}
          <div class="stack-row"><span class="stack-icon">{item[0]}</span><div><strong>{item[1]}</strong><span>{item[2]}</span></div><b>{item[3]}</b></div>
        {/each}
      </div>

      <div class="section-title-row stack-heading"><h3>正式证据</h3><span class="secondary-note">只读来源</span></div>
      <div class="evidence-list">
        {#each evidence as file}
          <button type="button" onclick={() => announce(`原型操作：打开 ${file[1]}`)}>
            <span class="stack-icon">{file[0]}</span>
            <span><strong>{file[1]}</strong><small>{file[2]}</small></span>
            <b>›</b>
          </button>
        {/each}
      </div>

      <div class="callout compact"><strong>Authority first：</strong>OpenSpec 与 Codex Runtime 无权改变正式授权；发生冲突时停止并显示 AUTHORITY_DRIFT。</div>
    </aside>
  </div>

  {#if toast}<div class="toast" role="status">{toast}</div>{/if}
</div>
