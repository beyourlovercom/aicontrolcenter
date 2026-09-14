<script lang="ts">
  import { onMount } from 'svelte';
  import {
    MAX_ACTIVE_ROOMS,
    bindGptConversation,
    closeExecutionRoom,
    createDefaultExecutionRoomStore,
    loadExecutionRoomStore,
    patchExecutionRoomUi,
    persistExecutionRoomStore,
    reopenExecutionRoom,
    selectExecutionRoom,
    selectMainline as selectMainlineView,
    toggleRoadmapSection,
    unbindGptConversation,
    type ExecutionRoomStore,
    type RoadmapSection
  } from './lib/executionRoomState';
  import { readChatgptSnapshots, snapshotForConversation, type ChatgptConversationSnapshot } from './lib/chatgptProjection';

  let roomStore: ExecutionRoomStore = createDefaultExecutionRoomStore();
  let toast = '';
  let chatgptSnapshots: ChatgptConversationSnapshot[] = [];
  let projectionError = '';

  $: activeViewId = roomStore.activeViewId;
  $: activeRooms = roomStore.activeRoomIds.map((id) => roomStore.rooms[id]).filter(Boolean);
  $: allRooms = roomStore.roomOrder.map((id) => roomStore.rooms[id]).filter(Boolean);
  $: activeRoom = activeViewId === 'mainline' ? activeRooms[0] ?? allRooms[0] : roomStore.rooms[activeViewId];
  $: leftPanelCollapsed = activeRoom?.ui.leftPanelCollapsed ?? false;
  $: rightPanelCollapsed = activeRoom?.ui.rightPanelCollapsed ?? false;
  $: collapsed = activeRoom?.ui.collapsedSections ?? { blueprint: false, wp: false, pr: false, task: false, gate: false };
  $: activeSnapshot = snapshotForConversation(chatgptSnapshots, activeRoom?.gptConversationBinding ?? null);
  $: boundRoomCount = allRooms.filter((room) => Boolean(room.gptConversationBinding)).length;

  onMount(() => {
    roomStore = loadExecutionRoomStore(window.localStorage);
    let cancelled = false;
    const refreshProjection = async () => {
      try {
        const snapshots = await readChatgptSnapshots();
        if (cancelled) return;
        chatgptSnapshots = snapshots;
        projectionError = '';
      } catch (error) {
        if (cancelled) return;
        projectionError = error instanceof Error ? error.message : String(error);
      }
    };
    void refreshProjection();
    const timer = window.setInterval(() => void refreshProjection(), 1800);
    return () => { cancelled = true; window.clearInterval(timer); };
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

  function closeRoom(event: Event, id: string) {
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

  function roomBoundToConversation(conversationId: string) {
    return allRooms.find((room) => room.gptConversationBinding === conversationId) ?? null;
  }

  function bindSnapshot(event: Event) {
    if (!activeRoom) return;
    const select = event.currentTarget as HTMLSelectElement;
    const snapshot = chatgptSnapshots.find((item) => item.conversationId === select.value);
    if (!snapshot) return;
    try {
      commit(bindGptConversation(roomStore, activeRoom.roomId, {
        conversationId: snapshot.conversationId,
        conversationUrl: snapshot.conversationUrl,
        title: snapshot.title
      }));
      announce(`已绑定真实 ChatGPT 会话：${snapshot.title}`);
    } catch (error) {
      announce(error instanceof Error ? error.message : String(error));
    }
    select.value = '';
  }

  function unbindCurrentConversation() {
    if (!activeRoom) return;
    commit(unbindGptConversation(roomStore, activeRoom.roomId));
    announce('已解除当前 Room 的 ChatGPT 会话绑定；Chrome 会话本身未关闭。');
  }

  function capturedLabel(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
    <div class="header-status"><span class="status-dot"></span><span>V5.2 · Chrome GPT Binding · {activeRooms.length} / {MAX_ACTIVE_ROOMS} ACTIVE</span></div>
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
          <span class="tab-close" role="button" tabindex="0" aria-label={`关闭 ${room.name}`} onclick={(event) => closeRoom(event, room.roomId)} onkeydown={(event) => { if (event.key === 'Enter' || event.key === ' ') closeRoom(event, room.roomId); }}>×</span>
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
          <span class="shell-badge">V5.2 Chrome GPT Binding · 真实会话投影</span>
        </section>

        <section class="mainline-kpis">
          <article><span>当前阶段</span><strong>V5.2</strong><small>Chrome GPT Binding</small></article>
          <article><span>Active Rooms</span><strong>{activeRooms.length} / {MAX_ACTIVE_ROOMS}</strong><small>状态层硬限制</small></article>
          <article><span>GPT Bindings</span><strong>{boundRoomCount} / {allRooms.length}</strong><small>每个 Room 独立 conversationId</small></article>
          <article><span>Detected GPT</span><strong>{chatgptSnapshots.length}</strong><small>Profile 12 实时 snapshot</small></article>
          <article><span>V5.1</span><strong>MERGED</strong><small>main@3eebdbe</small></article>
        </section>

        <section class="mainline-card">
          <div class="mainline-section-heading"><div><h2>完整主线进度视图</h2><p>V5 Roadmap · 从产品方向到多 Room Managed Execution</p></div><span class="mini-progress">V5.2 BINDING</span></div>
          <div class="stage-flow">
            <div class="stage done"><b>✓</b><strong>Blueprint</strong><span>产品方向冻结</span><i><em style="width:100%"></em></i><small>100%</small></div>
            <div class="stage done"><b>✓</b><strong>V5.0 Shell</strong><span>PR #26 已合并</span><i><em style="width:100%"></em></i><small>100%</small></div>
            <div class="stage done"><b>✓</b><strong>V5.1 Isolation</strong><span>PR #27 已合并</span><i><em style="width:100%"></em></i><small>100%</small></div>
            <div class="stage current"><b>●</b><strong>V5.2 GPT</strong><span>Chrome Binding</span><i><em style="width:65%"></em></i><small>65%</small></div>
            <div class="stage"><b>○</b><strong>V5.3–5.5</strong><span>Facts / Loop / Hardening</span><i><em style="width:0%"></em></i><small>0%</small></div>
          </div>
        </section>

        <section class="mainline-card">
          <div class="mainline-section-heading"><div><h2>Execution Rooms</h2><p>关闭 Room 只关闭 UI；branch / worktree / 草稿 / Roadmap 状态全部保留</p></div></div>
          <div class="room-overview-grid">
            {#each allRooms as room}
              <button type="button" class="room-overview-card" onclick={() => openOrReopenRoom(room.roomId)}>
                <div><span class="room-running-dot"></span><strong>{room.name}</strong><small>{room.gptConversationTitle ?? '未绑定真实 ChatGPT 会话'} · {room.branch}</small></div>
                <span class="room-shell-status">{roomStore.activeRoomIds.includes(room.roomId) ? 'ACTIVE' : '已关闭 · 可恢复'}</span><b>›</b>
              </button>
            {/each}
          </div>
        </section>

        <section class="mainline-grid">
          <article class="mainline-card">
            <div class="mainline-section-heading"><div><h2>主线 Gate</h2><p>不会自动越过 Owner 审批</p></div></div>
            <div class="gate-list">
              <div class="gate-row current"><span>●</span><div><strong>V5.2 Chrome GPT Binding Gate</strong><small>真实 Profile 12 会话可发现、绑定、投影且不串 Room</small></div><b>UAT NEXT</b></div>
              <div class="gate-row"><span>○</span><div><strong>V5.3 Executor Facts Gate</strong><small>branch / PR / CI 与 GitHub 事实一致</small></div><b>LATER</b></div>
              <div class="gate-row"><span>○</span><div><strong>V5.3 Executor Facts Gate</strong><small>branch / PR / CI 与 GitHub 事实一致</small></div><b>LATER</b></div>
            </div>
          </article>
          <article class="mainline-card">
            <div class="mainline-section-heading"><div><h2>V5.2 Source of Truth</h2><p>当前 branch 只负责真实 Chrome GPT Binding / Projection</p></div></div>
            <div class="mainline-facts">
              <div><span>Base SHA</span><strong>3eebdbe</strong></div>
              <div><span>V5.2 Branch</span><strong>feat/aicc-v5-chrome-gpt-binding</strong></div>
              <div><span>Projection</span><strong>Profile 12 · chatgpt-web</strong></div>
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
            <span class="phase-pill">V5.2</span>
          </div>

          <div class="roadmap-title-row">
            <div><strong>支线进度</strong><span>{activeRoom.projectId} / {activeRoom.workstreamId}</span></div>
            <span class="mini-progress">GPT Binding</span>
          </div>

          <div class="roadmap-groups">
            <section class="roadmap-group">
              <button class="group-toggle" type="button" onclick={() => toggle('blueprint')}><span>Blueprint · 蓝图</span><b>1 / 1</b><i>{collapsed.blueprint ? '›' : '⌄'}</i></button>
              {#if !collapsed.blueprint}<div class="roadmap-item done"><span>✓</span><div><strong>V5 产品方向冻结</strong><small>Multi-Execution Workbench</small></div></div>{/if}
            </section>

            <section class="roadmap-group">
              <button class="group-toggle" type="button" onclick={() => toggle('wp')}><span>WP · 工作包</span><b>1 / 1</b><i>{collapsed.wp ? '›' : '⌄'}</i></button>
              {#if !collapsed.wp}<div class="roadmap-item current"><span>●</span><div><strong>V5.2 — Chrome GPT Binding</strong><small>Real conversation projection + per-Room binding</small></div></div>{/if}
            </section>

            <section class="roadmap-group">
              <button class="group-toggle" type="button" onclick={() => toggle('pr')}><span>PR · 需求与计划</span><b>0 / 1</b><i>{collapsed.pr ? '›' : '⌄'}</i></button>
              {#if !collapsed.pr}<div class="roadmap-item pending"><span>○</span><div><strong>V5.2 Chrome GPT Binding PR</strong><small>Binding UAT 后才进入 PR Gate</small></div></div>{/if}
            </section>

            <section class="roadmap-group">
              <button class="group-toggle" type="button" onclick={() => toggle('task')}><span>Task · 任务执行</span><b>4 / 5</b><i>{collapsed.task ? '›' : '⌄'}</i></button>
              {#if !collapsed.task}
                <div class="roadmap-item done"><span>✓</span><div><strong>Canonical Browser Bridge Reuse</strong><small>Profile 12 · fixed extension identity</small></div></div>
                <div class="roadmap-item done"><span>✓</span><div><strong>Read-only Transcript Projection</strong><small>真实 user / assistant DOM snapshot</small></div></div>
                <div class="roadmap-item done"><span>✓</span><div><strong>Per-Room Conversation Binding</strong><small>conversationId 唯一绑定，不允许串线</small></div></div>
                <div class="roadmap-item done"><span>✓</span><div><strong>No-Spawn Read Path</strong><small>读取不会创建 Chrome Tab</small></div></div>
                <div class="roadmap-item current"><span>●</span><div><strong>Owner Binding UAT</strong><small>发现 / 绑定 / 切换 / 真实投影</small></div></div>
              {/if}
            </section>

            <section class="roadmap-group">
              <button class="group-toggle" type="button" onclick={() => toggle('gate')}><span>Gate · 阶段评审</span><b>0 / 1</b><i>{collapsed.gate ? '›' : '⌄'}</i></button>
              {#if !collapsed.gate}<div class="roadmap-item current"><span>●</span><div><strong>V5.2 Chrome GPT Binding Gate</strong><small>PASS 后才能进入 V5.3</small></div></div>{/if}
            </section>
          </div>
        {/if}
      </aside>

      <main class="gpt-panel">
        <div class="gpt-header">
          <div>
            <span class="eyebrow">真实 Chrome ChatGPT 会话 · Profile 12</span>
            <h1>{activeRoom.name}</h1>
          </div>
          {#if activeRoom.gptConversationBinding}
            <div class="binding-actions"><span class="binding-pill live-binding"><span></span>{activeRoom.gptConversationTitle ?? activeRoom.gptConversationBinding}</span><button class="binding-link" type="button" onclick={unbindCurrentConversation}>解绑</button></div>
          {:else}
            <select class="conversation-select" aria-label="绑定真实 ChatGPT 会话" onchange={bindSnapshot} value="">
              <option value="">{chatgptSnapshots.length ? '选择真实 ChatGPT 会话…' : '未检测到打开的 ChatGPT 会话'}</option>
              {#each chatgptSnapshots as snapshot}
                {@const owner = roomBoundToConversation(snapshot.conversationId)}
                <option value={snapshot.conversationId} disabled={Boolean(owner)}>{snapshot.title} · {snapshot.conversationId.slice(0, 8)}{owner ? ` · 已绑定 ${owner.name}` : ''}</option>
              {/each}
            </select>
          {/if}
        </div>

        <div class="conversation-shell">
          {#if activeSnapshot}
            <div class="conversation-notice live-conversation-notice">
              <div class="notice-icon">✦</div>
              <div><strong>真实 ChatGPT Transcript · {activeSnapshot.title}</strong><p>conversationId：{activeSnapshot.conversationId} · snapshot {capturedLabel(activeSnapshot.capturedAt)} · {activeSnapshot.messages.length} 条可见消息。内容来自 Profile 12 页面 DOM，不使用 OpenAI API。</p></div>
            </div>
            {#each activeSnapshot.messages as message}
              <div class="chat-preview" class:user-message={message.role === 'user'}>
                <span class:assistant={message.role === 'assistant'} class="message-avatar">{message.role === 'user' ? '你' : '✦'}</span>
                <div><strong>{message.role === 'user' ? 'You · Chrome' : 'ChatGPT · Chrome'}</strong><p class="projected-message">{message.text}</p></div>
              </div>
            {/each}
          {:else if activeRoom.gptConversationBinding}
            <div class="conversation-notice stale-conversation-notice"><div class="notice-icon">!</div><div><strong>已绑定，但当前没有实时 snapshot</strong><p>{activeRoom.gptConversationUrl}。请保持该真实 ChatGPT 会话在 Profile 12 中打开；AICC 不会为读取动作自动创建新 Tab。</p></div></div>
          {:else}
            <div class="conversation-notice">
              <div class="notice-icon">✦</div>
              <div><strong>等待绑定真实 Chrome ChatGPT 会话</strong><p>{chatgptSnapshots.length ? `已检测到 ${chatgptSnapshots.length} 个真实会话，请在右上角选择一次完成 Room 绑定。` : '当前 Profile 12 没有已打开的 chatgpt.com/c/... 会话。V5.2 不会自动 spawn Chrome Tab。'}{projectionError ? ` · Projection: ${projectionError}` : ''}</p></div>
            </div>
          {/if}
        </div>

        <div class="composer-shell">
          <div class="composer-input"><span class="composer-plus">＋</span><input class="composer-draft" style="width:100%;border:0;outline:0;background:transparent;color:#111;font:inherit;" value={activeRoom.ui.draft} oninput={updateDraft} placeholder="V5.2 本地草稿 · 真实发送仍受 Owner authorization Gate 控制" /><span class="composer-mic">⌁</span></div>
          <button class="next-step-button" type="button" onclick={() => announce('V5.2 STOP Gate：当前只做真实会话绑定/投影；自动推进在后续 Closed Loop Gate 接入')}>推进下一步</button>
        </div>
      </main>

      <aside class="facts-panel">
        <button class="panel-collapse panel-collapse-right" type="button" aria-label={rightPanelCollapsed ? '展开右侧事实' : '收起右侧事实'} onclick={toggleRightPanel}>{rightPanelCollapsed ? '‹' : '›'}</button>
        {#if !rightPanelCollapsed}
          <div class="panel-heading facts-heading">
            <div><span class="eyebrow">Chrome GPT Binding</span><h2>执行详情</h2></div>
            <span class="live-pill"><i></i>{activeRoom.status}</span>
          </div>

          <div class="fact-stack">
            <div class="fact-row"><span>Room ID</span><strong>{activeRoom.roomId}</strong></div>
            <div class="fact-row"><span>Project / Workstream</span><strong>{activeRoom.projectId} / {activeRoom.workstreamId}</strong></div>
            <div class="fact-row"><span>分支名称</span><strong>{activeRoom.branch}</strong></div>
            <div class="fact-row"><span>工作目录</span><strong>{activeRoom.worktree}</strong></div>
            <div class="fact-row"><span>Base SHA</span><strong class="mono">{activeRoom.baseSha.slice(0, 8)}</strong></div>
            <div class="fact-row"><span>GPT Conversation</span><strong>{activeRoom.gptConversationBinding ?? 'UNBOUND'}</strong></div>
            <div class="fact-row"><span>Projection</span><strong>{activeSnapshot ? `LIVE · ${activeSnapshot.messages.length} messages` : activeRoom.gptConversationBinding ? 'WAITING SNAPSHOT' : 'UNBOUND'}</strong></div>
            <div class="fact-row"><span>Codex Session</span><strong>{activeRoom.codexSession ?? 'UNBOUND'}</strong></div>
            <div class="fact-row"><span>Next Gate</span><strong>{activeRoom.nextGate}</strong></div>
          </div>

          <div class="log-block">
            <div class="log-heading"><strong>V5.2 Binding Evidence</strong><span>{chatgptSnapshots.length} DETECTED</span></div>
            <div class="log-line"><span>01</span><p>Profile 12 canonical extension 被复用，不走 OpenAI API</p></div>
            <div class="log-line"><span>02</span><p>Read path 只读取现有 ChatGPT Tab，不自动创建 Tab</p></div>
            <div class="log-line"><span>03</span><p>conversationId 在 Room 间唯一绑定</p></div>
            <div class="log-line current"><span>NOW</span><p>WAITING → Owner Binding UAT</p></div>
          </div>

          <div class="facts-note"><strong>Chrome = GPT Conversation Source</strong><p>中间区只投影真实 Profile 12 会话；GitHub 继续是代码/PR/CI 的唯一事实源，V5.3 再接 Executor Facts。</p></div>
        {/if}
      </aside>
    </section>
  {/if}

  {#if toast}<div class="toast" role="status">{toast}</div>{/if}
</div>
