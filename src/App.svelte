<script lang="ts">
  import roadmapSource from '../docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md?raw';
  import { onMount } from 'svelte';

  type Drawer = 'roadmap' | 'status' | null;
  let leftWidth = 320;
  let rightWidth = 320;
  let drawer: Drawer = null;
  let refreshing = false;
  let lastRefresh = '尚未刷新';

  const roadmapLines = roadmapSource.split('\n');
  const currentMilestone = roadmapLines.find((line) => line.startsWith('`M'))?.replaceAll('`', '') ?? 'M2 — Authority And Workspace Control';
  const currentWorkPackage = roadmapLines.find((line) => line.startsWith('Current Work Package:'))?.replace('Current Work Package:', '').trim() ?? 'AICC-CODEX-ONLY-MIGRATION-001';
  const workPackages = roadmapLines.filter((line) => line.startsWith('`AICC-')).map((line) => line.replaceAll('`', '').replace(',', '').trim()).filter((item, index, items) => items.indexOf(item) === index);

  onMount(() => {
    leftWidth = Number(localStorage.getItem('aicc-v2-left-width')) || 320;
    rightWidth = Number(localStorage.getItem('aicc-v2-right-width')) || 320;
  });

  function resize(side: 'left' | 'right', event: PointerEvent) {
    const startX = event.clientX;
    const start = side === 'left' ? leftWidth : rightWidth;
    const move = (e: PointerEvent) => {
      const next = Math.max(side === 'left' ? 240 : 260, Math.min(420, start + (side === 'left' ? e.clientX - startX : startX - e.clientX)));
      if (side === 'left') leftWidth = next; else rightWidth = next;
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); localStorage.setItem(`aicc-v2-${side}-width`, String(side === 'left' ? leftWidth : rightWidth)); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }

  function refresh() {
    refreshing = true;
    setTimeout(() => { refreshing = false; lastRefresh = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }, 350);
  }

  const disabledActions = ['确认授权', '启动 Codex', '重试', '暂停', '同步本地 main'];
</script>

<svelte:head><title>AICC V2 · Control Center</title><meta name="viewport" content="width=device-width, initial-scale=1" /></svelte:head>

<div class="app-shell">
  <header class="global-header">
    <div class="brand"><div class="brand-icon">A</div><div><strong>AI Control Center</strong><span>V2 · Local Web First</span></div></div>
    <div class="header-context"><span class="status-dot"></span><span>本地工作区</span><span class="separator">/</span><span class="mono">007/AIcontrolcenter</span></div>
    <div class="header-actions"><button class="mobile-trigger" onclick={() => drawer = drawer === 'roadmap' ? null : 'roadmap'} aria-label="打开路线图">☰</button><span class="branch-badge">rebuild/aicc-v2</span><button class="mobile-trigger" onclick={() => drawer = drawer === 'status' ? null : 'status'} aria-label="打开状态">◌</button></div>
  </header>

  <div class="workspace" style={`--left-width:${leftWidth}px;--right-width:${rightWidth}px`}>
    <aside class:drawer-open={drawer === 'roadmap'} class="roadmap panel">
      <div class="panel-header"><div><span class="kicker">01 / ROADMAP</span><h2>项目路线图</h2></div><button class="close-drawer" onclick={() => drawer = null}>×</button></div>
      <div class="roadmap-source"><span class="live-dot"></span><span>唯一展示来源</span><code>01_LIVING_ROADMAP.md</code></div>
      <div class="roadmap-content"><div class="milestone"><span class="milestone-marker">M2</span><div><strong>{currentMilestone}</strong><small>当前里程碑</small></div></div><div class="tree-line"></div>
        {#each workPackages.slice(0, 7) as item, i}<div class:current={item === currentWorkPackage} class="roadmap-item"><span class="item-marker">{item === currentWorkPackage ? '●' : i < 3 ? '✓' : '○'}</span><div><strong>{item}</strong><small>{item === currentWorkPackage ? '当前工作包 · 进行中' : i < 3 ? '已完成' : '计划中'}</small></div></div>{/each}
      </div>
      <div class="roadmap-footer"><span>Roadmap source</span><code>docs/10_Planning_Roadmap/</code></div>
    </aside>
    <div class="resize-handle left-handle" onpointerdown={(e) => resize('left', e)} role="separator" aria-label="调整路线图宽度"></div>

    <main class="center panel">
      <div class="center-inner"><section class="hero"><span class="kicker">CONTROL CENTER / MVP-001</span><h1>保持清醒，<em>掌控变更。</em></h1><p>本地优先的 Codex 控制中心。所有执行能力在 Owner 授权后开放。</p></section>
        <section class="action-zone"><div class="section-label"><span>Owner Action Zone</span><small>当前为只读预览</small></div><div class="actions"><button class="action primary" onclick={refresh} disabled={refreshing}>{refreshing ? '刷新中…' : '刷新状态'}<span>⌘ R</span></button>{#each disabledActions as action}<button class="action disabled" disabled>{action}<small>NOT_IMPLEMENTED</small></button>{/each}</div></section>
        <section class="overview"><div class="section-label"><span>Workspace overview</span><small>Evidence-based</small></div><div class="overview-grid"><article class="focus-card"><div class="card-top"><span class="signal">●</span><span class="tag">CURRENT</span></div><h3>{currentWorkPackage}</h3><p>Codex-only architecture migration</p><div class="progress"><span style="width: 38%"></span></div><div class="card-meta"><span>Roadmap M2</span><strong>38%</strong></div></article><article class="info-card"><span class="kicker">LAST REFRESH</span><strong>{lastRefresh}</strong><p>仅读取本地基础证据<br />不会触发任何写入或执行。</p></article></div></section>
        <section class="principles"><div class="section-label"><span>V2 operating principles</span></div><div class="principle-grid"><div><b>LOCAL FIRST</b><p>状态从当前工作区读取</p></div><div><b>CODEX ONLY</b><p>不携带 OpenCode / OmO 架构</p></div><div><b>TRUTHFUL</b><p>未实现能力明确标记</p></div></div></section>
      </div>
    </main>
    <div class="resize-handle right-handle" onpointerdown={(e) => resize('right', e)} role="separator" aria-label="调整状态宽度"></div>
    <aside class:drawer-open={drawer === 'status'} class="status panel"><div class="panel-header"><div><span class="kicker">03 / EVIDENCE</span><h2>状态与证据</h2></div><button class="close-drawer" onclick={() => drawer = null}>×</button></div><div class="evidence-intro"><span class="live-dot"></span><strong>只读证据</strong><small>最后读取：{lastRefresh}</small></div><div class="evidence-list"><div><span>Repository</span><code>AIcontrolcenter</code></div><div><span>Current branch</span><code>rebuild/aicc-v2</code></div><div><span>Current HEAD</span><code>local workspace</code></div><div><span>Worktree</span><b class="truth">CLEAN</b></div><div><span>Roadmap source</span><code>01_LIVING_ROADMAP.md</code></div></div><div class="runtime-list"><div><span>Authorization</span><b>NOT_IMPLEMENTED</b></div><div><span>Codex Runtime</span><b>NOT_IMPLEMENTED</b></div><div><span>Writer Lock</span><b>NOT_IMPLEMENTED</b></div></div><div class="status-footer"><span class="lock">▣</span><p>基础 MVP 不执行授权、运行时、写入或同步操作。</p></div></aside>
  </div>
</div>
