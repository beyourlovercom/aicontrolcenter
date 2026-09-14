<script lang="ts">
  import { onMount } from 'svelte';
  import {
    MAX_ACTIVE_ROOMS,
    closeExecutionRoom,
    createDefaultExecutionRoomStore,
    loadExecutionRoomStore,
    patchExecutionRoomUi,
    persistExecutionRoomStore,
    reopenExecutionRoom,
    selectExecutionRoom,
    selectMainline as selectMainlineView,
    toggleRoadmapSection,
    type ExecutionRoomStore,
    type RoadmapSection
  } from './lib/executionRoomState';

  let roomStore: ExecutionRoomStore = createDefaultExecutionRoomStore();
  let toast = '';

  $: activeViewId = roomStore.activeViewId;
  $: activeRooms = roomStore.activeRoomIds.map((id) => roomStore.rooms[id]).filter(Boolean);
  $: allRooms = roomStore.roomOrder.map((id) => roomStore.rooms[id]).filter(Boolean);
  $: activeRoom = activeViewId === 'mainline' ? activeRooms[0] ?? allRooms[0] : roomStore.rooms[activeViewId];
  $: leftPanelCollapsed = activeRoom?.ui.leftPanelCollapsed ?? false;
  $: rightPanelCollapsed = activeRoom?.ui.rightPanelCollapsed ?? false;
  $: collapsed = activeRoom?.ui.collapsedSections ?? { blueprint: false, wp: false, pr: false, task: false, gate: false };

  onMount(() => {
    roomStore = loadExecutionRoomStore(window.localStorage);
  });

  function commit(next: ExecutionRoomStore) {
    roomStore = next;
    if (typeof window !== 'undefined') persistExecutionRoomStore(window.localStorage, next);
  }

  function selectRoom(id: string) {
    try {
      commit(selectExecutionRoom(roomStore, id));
    } catch (error) {
      announce(error instanceof Error ? error.message : String(error));
    }
  }

  function selectMainline() {
    commit(selectMainlineView(roomStore));
  }

  function closeRoom(event: MouseEvent, id: string) {
    event.stopPropagation();
    commit(closeExecutionRoom(roomStore, id));
  }

  function openOrReopenRoom(id: string) {
    try {
      if (roomStore.activeRoomIds.includes(id)) commit(selectExecutionRoom(roomStore, id));
      else commit(reopenExecutionRoom(roomStore, id));
    } catch (error) {
      announce(error instanceof Error ? error.message : String(error));
    }
  }

  function addOrReopenRoom() {
    const inactiveRoomId = roomStore.roomOrder.find((id) => !roomStore.activeRoomIds.includes(id));
    if (inactiveRoomId) {
      openOrReopenRoom(inactiveRoomId);
      return;
    }
    announce(`ACTIVE ROOM 已达上限 ${MAX_ACTIVE_ROOMS}；请先关闭一个 Room。`);
  }

  function announce(message: string) {
    toast = message;
    window.setTimeout(() => {
      if (toast === message) toast = '';
    }, 1900);
  }

  function toggle(section: RoadmapSection) {
    if (!activeRoom) return;
    commit(toggleRoadmapSection(roomStore, activeRoom.roomId, section));
  }

  function toggleLeftPanel() {
    if (!activeRoom) return;
    commit(patchExecutionRoomUi(roomStore, activeRoom.roomId, { leftPanelCollapsed: !activeRoom.ui.leftPanelCollapsed }));
  }

  function toggleRightPanel() {
    if (!activeRoom) return;
    commit(patchExecutionRoomUi(roomStore, activeRoom.roomId, { rightPanelCollapsed: !activeRoom.ui.rightPanelCollapsed }));
  }

  function updateDraft(event: Event) {
    if (!activeRoom) return;
    const input = event.currentTarget as HTMLInputElement;
    commit(patchExecutionRoomUi(roomStore, activeRoom.roomId, { draft: input.value }));
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
    <div class="header-status"><span class="status-dot"></span><span>V5.1 · Room State / Isolation · {activeRooms.length} / {MAX_ACTIVE_ROOMS} ACTIVE</span></div>
  </header>

  <nav class="room-tabs" aria-label="Execution Rooms">
    <div class="room-tabs-track">
      <button class:active={activeViewId === 'mainline'} class="room-tab mainline-tab" type="button" onclick={selectMainline}>
        <span class="mainline-icon">⌂</span>
        <span>主线面板</span>
      </button>
      {#each activeRooms as room}
        <button class:active={room.roomId === activeViewId} class="room-tab" type="button" onclick={() => selectRoom(room.roomId)}>
          <span class="room-running-dot" aria-hidden="true"></span>
          <span>{room.name}</span>
          <span class="tab-close" role="button" tabindex="0" aria-label={`关闭 ${room.name}`} onclick={(event) => closeRoom(event, room.roomId)}>×</span>
        </button>
      {/each}
      <button class="add-room" type="button" onclick={addOrReopenRoom}>+</button>
    </div>
  </nav>

  {#if activeViewId === 'mainline'}
    <main class="mainline-panel">
      <div class="mainline-scroll">
        <section class="mainline-hero">
          <div><span class="eyebrow">Always-on Mainline View</span><h1>主线面板</h1><p>完整查看 AICC V5 从 Blueprint 到 Gate 的整体推进，并从这里恢复或切换任一 Execution Room。</p></div>
          <span class="shell-badge">V5.1 Room State · V5.3 接实时事实</span>
        </section>

        <section class="mainline-kpis">
          <article><span>当前阶段</span><strong>V5.1</strong><small>Room State / Isolation</small></article>
          <article><span>Active Rooms</span><strong>{activeRooms.length} / {MAX_ACTIVE_ROOMS}</strong><small>状态层硬限制</small></article>
          <article><span>持久化</span><strong>ON</strong><small>localStorage · V1 schema</small></article>
          <article><span>V5.0</span><strong>MERGED</strong><small>main@301d176</small></article>
          <article><span>Blocker</span><strong>0</strong><small>等待 Runtime UAT</small></article>
        </section>

        <section class="mainline-card">
          <div class="mainline-section-heading"><div><h2>完整主线进度视图</h2><p>V5 Roadmap · 从产品方向到多 Room Managed Execution</p></div><span class="mini-progress">V5.1 IMPLEMENTING</span></div>
          <div class="stage-flow">
            <div class="stage done"><b>✓</b><strong>Blueprint</strong><span>产品方向冻结</span><i><em style="width:100%"></em></i><small>100%</small></div>
            <div class="stage done"><b>✓</b><strong>V5.0 Shell</strong><span>PR #26 已合并</span><i><em style="width:100%"></em></i><small>100%</small></div>
            <div class="stage current"><b>●</b><strong>V5.1 Isolation</strong><span>Room State</span><i><em style="width:75%"></em></i><small>75%</small></div>
            <div class="stage"><b>○</b><strong>V5.2 GPT</strong><span>Chrome Binding</span><i><em style="width:0%"></em></i><small>0%</small></div>
            <div class="stage"><b>○</b><strong>V5.3–5.5</strong><span>Facts / Loop / Hardening</span><i><em style="width:0%"></em></i><small>0%</small></div>
          </div>
        </section>

        <section class="mainline-card">
          <div class="mainline-section-heading"><div><h2>Execution Rooms</h2><p>关闭 Room 只关闭 UI；branch / worktree / 草稿 / Roadmap 状态全部保留</p></div></div>
          <div class="room-overview-grid">
            {#each allRooms as room}
              <button type="button" class="room-overview-card" onclick={() => openOrReopenRoom(room.roomId)}>
                <div><span class="room-running-dot"></span><strong>{room.name}</strong><small>{room.branch} · {room.worktree}</small></div>
                <span class="room-shell-status">{roomStore.activeRoomIds.includes(room.roomId) ? 'ACTIVE' : '已关闭 · 可恢复'}</span><b>›</b>
              </button>
            {/each}
          </div>
        </section>

        <section class="mainline-grid">
          <article class="mainline-card">
            <div class="mainline-section-heading"><div><h2>主线 Gate</h2><p>不会自动越过 Owner 审批</p></div></div>
            <div class="gate-list">
              <div class="gate-row current"><span>●</span><div><strong>V5.1 Room Isolation Gate</strong><small>验证四 Room 切换、关闭/恢复、刷新后均不串状态</small></div><b>UAT NEXT</b></div>
              <div class="gate-row"><span>○</span><div><strong>V5.2 Chrome GPT Binding Gate</strong><small>2–4 条真实 GPT 支线可继续对话</small></div><b>LATER</b></div>
              <div class="gate-row"><span>○</span><div><strong>V5.3 Executor Facts Gate</strong><small>branch / PR / CI 与 GitHub 事实一致</small></div><b>LATER</b></div>
            </div>
          </article>
          <article class="mainline-card">
            <div class="mainline-section-heading"><div><h2>V5.1 Source of Truth</h2><p>当前 branch 只负责 Room State / Isolation</p></div></div>
            <div class="mainline-facts">
              <div><span>Base SHA</span><strong>301d176</strong></div>
              <div><span>V5.1 Branch</span><strong>feat/aicc-v5-room-state-isolation</strong></div>
              <div><span>Persistence Key</span><strong>aicc.v5.execution-rooms.v1</strong></div>
              <div><span>Production</span><strong>1420 · READY · 未重启</strong></div>
            </div>
          </article>
        </section>
      </div>
    </main>
  {:else if activeRoom}
    <section class:left-collapsed={leftPanelCollapsed} class:right-collapsed={rightPanelCollapsed} class="workspace-shell">
      <aside class="roadmap-panel">
        <button class="panel-collapse panel-collapse-left" type="button" aria-label={leftPanelCollapsed ? '展开左侧进度' : '收起左侧进度'} onclick={toggleLeftPanel}>{leftPanelCollapsed ? '›' : '‹'}</button>
        {#if !leftPanelCollapsed}
          <div class="panel-heading">
            <div>
              <span class="eyebrow">当前 Execution Room</span>
              <h2>{activeRoom.name}</h2>
            </div>
            <span class="phase-pill">V5.1</span>
          </div>

          <div class="roadmap-title-row">
            <div><strong>支线进度</strong><span>{activeRoom.projectId} / {activeRoom.workstreamId}</span></div>
            <span class="mini-progress">Isolation</span>
          </div>

          <div class="roadmap-groups">
            <section class="roadmap-group">
              <button class="group-toggle" type="button" onclick={() => toggle('blueprint')}><span>Blueprint · 蓝图</span><b>1 / 1</b><i>{collapsed.blueprint ? '›' : '⌄'}</i></button>
              {#if !collapsed.blueprint}<div class="roadmap-item done"><span>✓</span><div><strong>V5 产品方向冻结</strong><small>Multi-Execution Workbench</small></div></div>{/if}
            </section>

            <section class="roadmap-group">
              <button class="group-toggle" type="button" onclick={() => toggle('wp')}><span>WP · 工作包</span><b>1 / 1</b><i>{collapsed.wp ? '›' : '⌄'}</i></button>
              {#if !collapsed.wp}<div class="roadmap-item current"><span>●</span><div><strong>{activeRoom.currentWp}</strong><small>Persistent room state + isolation</small></div></div>{/if}
            </section>

            <section class="roadmap-group">
              <button class="group-toggle" type="button" onclick={() => toggle('pr')}><span>PR · 需求与计划</span><b>0 / 1</b><i>{collapsed.pr ? '›' : '⌄'}</i></button>
              {#if !collapsed.pr}<div class="roadmap-item pending"><span>○</span><div><strong>V5.1 Room State PR</strong><small>Isolation UAT 后才进入 PR Gate</small></div></div>{/if}
            </section>

            <section class="roadmap-group">
              <button class="group-toggle" type="button" onclick={() => toggle('task')}><span>Task · 任务执行</span><b>4 / 5</b><i>{collapsed.task ? '›' : '⌄'}</i></button>
              {#if !collapsed.task}
                <div class="roadmap-item done"><span>✓</span><div><strong>Room State Schema</strong><small>room_id / project / workstream / Gate</small></div></div>
                <div class="roadmap-item done"><span>✓</span><div><strong>Per-Room UI Isolation</strong><small>左右栏 / Roadmap / 草稿独立</small></div></div>
                <div class="roadmap-item done"><span>✓</span><div><strong>Persistent Room State</strong><small>刷新后恢复当前状态</small></div></div>
                <div class="roadmap-item done"><span>✓</span><div><strong>4 Room Limit + Reopen</strong><small>关闭 UI 不删除 Room binding</small></div></div>
                <div class="roadmap-item current"><span>●</span><div><strong>Owner Isolation UAT</strong><small>切换 / 关闭 / 恢复 / 刷新</small></div></div>
              {/if}
            </section>

            <section class="roadmap-group">
              <button class="group-toggle" type="button" onclick={() => toggle('gate')}><span>Gate · 阶段评审</span><b>0 / 1</b><i>{collapsed.gate ? '›' : '⌄'}</i></button>
              {#if !collapsed.gate}<div class="roadmap-item current"><span>●</span><div><strong>V5.1 Room Isolation Gate</strong><small>PASS 后才能进入 V5.2</small></div></div>{/if}
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
              <strong>V5.1 Room Isolation</strong>
              <p>当前 Room 已有独立持久化状态。真实 Chrome ChatGPT 会话仍在 V5.2 才绑定；本阶段不会用 API 仿造 ChatGPT。</p>
            </div>
          </div>

          <div class="chat-preview user-message">
            <span class="message-avatar">你</span>
            <div><strong>Room ID：{activeRoom.roomId}</strong><p>{activeRoom.branch} · {activeRoom.worktree}</p></div>
          </div>

          <div class="chat-preview assistant-message">
            <span class="message-avatar assistant">✦</span>
            <div><strong>当前 Gate：{activeRoom.currentGate}</strong><p>在输入框随便写一段 Room 专属草稿，然后切换 Room；草稿、左右栏和 Roadmap 折叠状态都不应该串线。</p></div>
          </div>
        </div>

        <div class="composer-shell">
          <div class="composer-input"><span class="composer-plus">＋</span><input class="composer-draft" value={activeRoom.ui.draft} oninput={updateDraft} placeholder="输入当前 Room 的独立测试草稿…" /><span class="composer-mic">⌁</span></div>
          <button class="next-step-button" type="button" onclick={() => announce('V5.1 STOP Gate：Owner Isolation UAT PASS 前不进入 V5.2')}>推进下一步</button>
        </div>
      </main>

      <aside class="facts-panel">
        <button class="panel-collapse panel-collapse-right" type="button" aria-label={rightPanelCollapsed ? '展开右侧事实' : '收起右侧事实'} onclick={toggleRightPanel}>{rightPanelCollapsed ? '‹' : '›'}</button>
        {#if !rightPanelCollapsed}
          <div class="panel-heading facts-heading">
            <div><span class="eyebrow">Room Binding State</span><h2>执行详情</h2></div>
            <span class="live-pill"><i></i>{activeRoom.status}</span>
          </div>

          <div class="fact-stack">
            <div class="fact-row"><span>Room ID</span><strong>{activeRoom.roomId}</strong></div>
            <div class="fact-row"><span>Project / Workstream</span><strong>{activeRoom.projectId} / {activeRoom.workstreamId}</strong></div>
            <div class="fact-row"><span>分支名称</span><strong>{activeRoom.branch}</strong></div>
            <div class="fact-row"><span>工作目录</span><strong>{activeRoom.worktree}</strong></div>
            <div class="fact-row"><span>Base SHA</span><strong class="mono">{activeRoom.baseSha.slice(0, 8)}</strong></div>
            <div class="fact-row"><span>GPT Binding</span><strong>{activeRoom.gptConversationBinding ?? 'V5.2 PENDING'}</strong></div>
            <div class="fact-row"><span>Codex Session</span><strong>{activeRoom.codexSession ?? 'UNBOUND'}</strong></div>
            <div class="fact-row"><span>Next Gate</span><strong>{activeRoom.nextGate}</strong></div>
          </div>

          <div class="log-block">
            <div class="log-heading"><strong>V5.1 Isolation Evidence</strong><span>{activeRooms.length} ACTIVE</span></div>
            <div class="log-line"><span>01</span><p>Room 状态按 room_id 独立存储</p></div>
            <div class="log-line"><span>02</span><p>关闭 Room 不删除 branch/worktree binding</p></div>
            <div class="log-line"><span>03</span><p>ACTIVE Room 上限固定为 4</p></div>
            <div class="log-line current"><span>NOW</span><p>WAITING → Owner Isolation UAT</p></div>
          </div>

          <div class="facts-note"><strong>GitHub = Source of Truth</strong><p>V5.1 只负责 Room 状态隔离；真实 PR / CI / runtime facts 仍在 V5.3 接入。</p></div>
        {/if}
      </aside>
    </section>
  {/if}

  {#if toast}<div class="toast" role="status">{toast}</div>{/if}
</div>
