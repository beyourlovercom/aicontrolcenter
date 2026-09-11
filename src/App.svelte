<script lang="ts">
  type Room = {
    id: string;
    name: string;
    subtitle: string;
  };

  const rooms: Room[] = [
    { id: 'traffic', name: 'Traffic / Ads', subtitle: '执行支线' },
    { id: 'inquiry', name: 'Inquiry OS', subtitle: '执行支线' },
    { id: 'customer', name: 'Customer OS', subtitle: '执行支线' },
    { id: 'product', name: 'Product OS', subtitle: '执行支线' }
  ];

  let activeViewId = 'traffic';
  let toast = '';
  let leftPanelCollapsed = false;
  let rightPanelCollapsed = false;
  let collapsed = { blueprint: false, wp: false, pr: false, task: false, gate: false };

  $: activeRoom = rooms.find((room) => room.id === activeViewId) ?? rooms[0];

  function selectRoom(id: string) {
    activeViewId = id;
  }

  function selectMainline() {
    activeViewId = 'mainline';
  }

  function announce(message: string) {
    toast = message;
    window.setTimeout(() => {
      if (toast === message) toast = '';
    }, 1900);
  }

  function toggle(section: keyof typeof collapsed) {
    collapsed = { ...collapsed, [section]: !collapsed[section] };
  }
</script>

<div class="aicc-v5-shell">
  <header class="app-header">
    <div class="brand-group">
      <div class="brand-mark">✦</div>
      <div>
        <div class="brand-title">AICC</div>
        <div class="brand-subtitle">Multi-Execution Workbench</div>
      </div>
    </div>
    <div class="header-status"><span class="status-dot"></span><span>V5.0 · Execution Room Shell</span></div>
  </header>

  <nav class="room-tabs" aria-label="Execution Rooms">
    <div class="room-tabs-track">
      <button class:active={activeViewId === 'mainline'} class="room-tab mainline-tab" type="button" onclick={selectMainline}>
        <span class="mainline-icon">⌂</span>
        <span>主线面板</span>
      </button>
      {#each rooms as room}
        <button class:active={room.id === activeViewId} class="room-tab" type="button" onclick={() => selectRoom(room.id)}>
          <span class="room-running-dot" aria-hidden="true"></span>
          <span>{room.name}</span>
          {#if room.id !== 'traffic'}<span class="tab-close" aria-hidden="true">×</span>{/if}
        </button>
      {/each}
      <button class="add-room" type="button" onclick={() => announce('V5.1 接入 Room 创建与 4 Room 上限')}>+</button>
    </div>
  </nav>

  {#if activeViewId === 'mainline'}
    <main class="mainline-panel">
      <div class="mainline-scroll">
        <section class="mainline-hero">
          <div><span class="eyebrow">Always-on Mainline View</span><h1>主线面板</h1><p>完整查看 AICC V5 从 Blueprint 到 Gate 的整体推进，并从这里切回任一 Execution Room。</p></div>
          <span class="shell-badge">V5.0 UI Shell · V5.3 接实时事实</span>
        </section>

        <section class="mainline-kpis">
          <article><span>当前阶段</span><strong>V5.0</strong><small>Execution Room Shell · Owner UI UAT</small></article>
          <article><span>Room 容量</span><strong>4 MAX</strong><small>V5.1 接入真实 Room State</small></article>
          <article><span>Owner UAT</span><strong>1</strong><small>当前 STOP Gate</small></article>
          <article><span>PR</span><strong>0</strong><small>UI PASS 后才创建</small></article>
          <article><span>Blocker</span><strong>0</strong><small>当前无 UI 实施阻塞</small></article>
        </section>

        <section class="mainline-card">
          <div class="mainline-section-heading"><div><h2>完整主线进度视图</h2><p>V5 Roadmap · 从产品方向到多 Room Managed Execution</p></div><span class="mini-progress">Owner UI UAT</span></div>
          <div class="stage-flow">
            <div class="stage done"><b>✓</b><strong>Blueprint</strong><span>产品方向冻结</span><i><em style="width:100%"></em></i><small>100%</small></div>
            <div class="stage current"><b>●</b><strong>V5.0 Shell</strong><span>当前 Owner UAT</span><i><em style="width:90%"></em></i><small>90%</small></div>
            <div class="stage"><b>○</b><strong>V5.1 Isolation</strong><span>Room State</span><i><em style="width:0%"></em></i><small>0%</small></div>
            <div class="stage"><b>○</b><strong>V5.2 GPT</strong><span>Chrome Binding</span><i><em style="width:0%"></em></i><small>0%</small></div>
            <div class="stage"><b>○</b><strong>V5.3–5.5</strong><span>Facts / Loop / Hardening</span><i><em style="width:0%"></em></i><small>0%</small></div>
          </div>
        </section>

        <section class="mainline-card">
          <div class="mainline-section-heading"><div><h2>Execution Rooms</h2><p>主线面板始终保留；点击任一 Room 即进入独立执行工作台</p></div></div>
          <div class="room-overview-grid">
            {#each rooms as room, index}
              <button type="button" class="room-overview-card" onclick={() => selectRoom(room.id)}>
                <div><span class="room-running-dot"></span><strong>{room.name}</strong><small>V5.1 接入独立 branch / worktree / GPT / executor</small></div>
                <span class="room-shell-status">{index === 0 ? 'UI UAT' : '待绑定'}</span><b>›</b>
              </button>
            {/each}
          </div>
        </section>

        <section class="mainline-grid">
          <article class="mainline-card">
            <div class="mainline-section-heading"><div><h2>主线 Gate</h2><p>不会自动越过 Owner 审批</p></div></div>
            <div class="gate-list">
              <div class="gate-row current"><span>●</span><div><strong>Owner UI UAT</strong><small>当前 Gate · PASS 前禁止进入 V5.1</small></div><b>WAITING</b></div>
              <div class="gate-row"><span>○</span><div><strong>V5.1 Room Isolation Gate</strong><small>四条支线切换不串状态</small></div><b>NEXT</b></div>
              <div class="gate-row"><span>○</span><div><strong>V5.2 Chrome GPT Binding Gate</strong><small>2–4 条真实 GPT 支线可继续对话</small></div><b>LATER</b></div>
            </div>
          </article>
          <article class="mainline-card">
            <div class="mainline-section-heading"><div><h2>真实执行事实入口</h2><p>当前仅显示 V5.0 已核对事实；动态汇总从 V5.3 接入</p></div></div>
            <div class="mainline-facts">
              <div><span>Base SHA</span><strong>8c6e930</strong></div>
              <div><span>V5 Branch</span><strong>feat/aicc-v5-execution-room-shell</strong></div>
              <div><span>UAT Runtime</span><strong>CN Mac · 127.0.0.1:1422</strong></div>
              <div><span>Production</span><strong>1420 · READY · 未重启</strong></div>
            </div>
          </article>
        </section>
      </div>
    </main>
  {:else}
  <section class:left-collapsed={leftPanelCollapsed} class:right-collapsed={rightPanelCollapsed} class="workspace-shell">
    <aside class="roadmap-panel">
      <button class="panel-collapse panel-collapse-left" type="button" aria-label={leftPanelCollapsed ? '展开左侧进度' : '收起左侧进度'} onclick={() => leftPanelCollapsed = !leftPanelCollapsed}>{leftPanelCollapsed ? '›' : '‹'}</button>
      {#if !leftPanelCollapsed}
      <div class="panel-heading">
        <div>
          <span class="eyebrow">当前 Execution Room</span>
          <h2>{activeRoom.name}</h2>
        </div>
        <span class="phase-pill">V5.0</span>
      </div>

      <div class="roadmap-title-row">
        <div><strong>支线进度</strong><span>Roadmap / WP / PR / Task / Gate</span></div>
        <span class="mini-progress">UI UAT</span>
      </div>

      <div class="roadmap-groups">
        <section class="roadmap-group">
          <button class="group-toggle" type="button" onclick={() => toggle('blueprint')}><span>Blueprint · 蓝图</span><b>1 / 1</b><i>{collapsed.blueprint ? '›' : '⌄'}</i></button>
          {#if !collapsed.blueprint}<div class="roadmap-item done"><span>✓</span><div><strong>V5 产品方向冻结</strong><small>Multi-Execution Workbench</small></div></div>{/if}
        </section>

        <section class="roadmap-group">
          <button class="group-toggle" type="button" onclick={() => toggle('wp')}><span>WP · 工作包</span><b>1 / 1</b><i>{collapsed.wp ? '›' : '⌄'}</i></button>
          {#if !collapsed.wp}<div class="roadmap-item done"><span>✓</span><div><strong>V5.0 — Execution Room Shell</strong><small>Tabs + 三栏 Workspace + Green VI</small></div></div>{/if}
        </section>

        <section class="roadmap-group">
          <button class="group-toggle" type="button" onclick={() => toggle('pr')}><span>PR · 需求与计划</span><b>0 / 1</b><i>{collapsed.pr ? '›' : '⌄'}</i></button>
          {#if !collapsed.pr}<div class="roadmap-item pending"><span>○</span><div><strong>V5.0 UI Shell PR</strong><small>Owner UI UAT 通过后才进入 PR Gate</small></div></div>{/if}
        </section>

        <section class="roadmap-group">
          <button class="group-toggle" type="button" onclick={() => toggle('task')}><span>Task · 任务执行</span><b>3 / 4</b><i>{collapsed.task ? '›' : '⌄'}</i></button>
          {#if !collapsed.task}
            <div class="roadmap-item done"><span>✓</span><div><strong>Chrome 风格 Room Tabs</strong><small>当前 Room 单独切换</small></div></div>
            <div class="roadmap-item done"><span>✓</span><div><strong>三栏 Execution Workspace</strong><small>左 Roadmap / 中 GPT / 右 Facts</small></div></div>
            <div class="roadmap-item done"><span>✓</span><div><strong>绿色 VI</strong><small>低饱和、轻量、生产工具风格</small></div></div>
            <div class="roadmap-item current"><span>●</span><div><strong>Owner UI UAT</strong><small>当前 STOP Gate</small></div></div>
          {/if}
        </section>

        <section class="roadmap-group">
          <button class="group-toggle" type="button" onclick={() => toggle('gate')}><span>Gate · 阶段评审</span><b>0 / 1</b><i>{collapsed.gate ? '›' : '⌄'}</i></button>
          {#if !collapsed.gate}<div class="roadmap-item current"><span>●</span><div><strong>等待 Owner UI UAT</strong><small>PASS 前禁止进入 V5.1</small></div></div>{/if}
        </section>
      </div>
      {/if}
    </aside>

    <main class="gpt-panel">
      <div class="gpt-header">
        <div>
          <span class="eyebrow">真实 Chrome ChatGPT 会话</span>
          <h1>{activeRoom.name}</h1>
        </div>
        <div class="binding-pill"><span></span>V5.2 绑定</div>
      </div>

      <div class="conversation-shell">
        <div class="conversation-notice">
          <div class="notice-icon">✦</div>
          <div>
            <strong>GPT Conversation Container Shell</strong>
            <p>V5.0 只验证布局与操作逻辑。这里不会用 OpenAI API 仿造 ChatGPT；V5.2 才会绑定真实 Chrome ChatGPT 会话，并隐藏地址栏、浏览器 Tab 与外围控件。</p>
          </div>
        </div>

        <div class="chat-preview user-message">
          <span class="message-avatar">你</span>
          <div><strong>当前支线：{activeRoom.name}</strong><p>每个 Room 将独立保持 GPT 会话、branch、worktree 与 executor 状态。</p></div>
        </div>

        <div class="chat-preview assistant-message">
          <span class="message-avatar assistant">✦</span>
          <div><strong>当前处于 Owner UI UAT</strong><p>V5.0 只交付 Execution Room Shell。UI 通过后再进入 V5.1 Room State / Isolation。</p></div>
        </div>
      </div>

      <div class="composer-shell">
        <div class="composer-input"><span class="composer-plus">＋</span><span class="composer-placeholder">在当前 Room 中继续对话…</span><span class="composer-mic">⌁</span></div>
        <button class="next-step-button" type="button" onclick={() => announce('Owner UI UAT STOP Gate：PASS 前不推进 V5.1')}>推进下一步</button>
      </div>
    </main>

    <aside class="facts-panel">
      <button class="panel-collapse panel-collapse-right" type="button" aria-label={rightPanelCollapsed ? '展开右侧事实' : '收起右侧事实'} onclick={() => rightPanelCollapsed = !rightPanelCollapsed}>{rightPanelCollapsed ? '‹' : '›'}</button>
      {#if !rightPanelCollapsed}
      <div class="panel-heading facts-heading">
        <div><span class="eyebrow">Executor Facts</span><h2>执行详情</h2></div>
        <span class="live-pill"><i></i>事实壳</span>
      </div>

      <div class="fact-stack">
        <div class="fact-row"><span>分支名称</span><strong>feat/aicc-v5-execution-room-shell</strong></div>
        <div class="fact-row"><span>工作目录</span><strong>/worktrees/aicc-v5-execution-room-shell</strong></div>
        <div class="fact-row"><span>Base SHA</span><strong class="mono">8c6e930</strong></div>
        <div class="fact-row"><span>测试结果</span><strong>待本地验证</strong></div>
        <div class="fact-row"><span>PR 编号</span><strong>未创建 · UAT 后</strong></div>
        <div class="fact-row"><span>CI 状态</span><strong>未运行 · UAT 后</strong></div>
      </div>

      <div class="log-block">
        <div class="log-heading"><strong>最新执行日志</strong><span>V5.0</span></div>
        <div class="log-line"><span>17:32</span><p>从 origin/main exact SHA 创建隔离 worktree</p></div>
        <div class="log-line"><span>17:33</span><p>Execution Room Tabs shell 已实施</p></div>
        <div class="log-line"><span>17:33</span><p>三栏 Workspace / Green VI 已实施</p></div>
        <div class="log-line current"><span>NOW</span><p>STOP → Owner UI UAT</p></div>
      </div>

      <div class="facts-note"><strong>GitHub = Source of Truth</strong><p>V5.3 才接入真实 branch / worktree / tests / PR / CI / logs 动态事实。</p></div>
      {/if}
    </aside>
  </section>

  {/if}

  {#if toast}<div class="toast" role="status">{toast}</div>{/if}
</div>
