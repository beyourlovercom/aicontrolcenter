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
  import { readExecutorFacts, roomRuntimeBinding, type ExecutorFactsProjection } from './lib/executorFacts';

  let roomStore: ExecutionRoomStore = createDefaultExecutionRoomStore();
  let toast = '';
  let chatgptSnapshots: ChatgptConversationSnapshot[] = [];
  let projectionError = '';
  let executorFacts: ExecutorFactsProjection | null = null;
  let executorFactsError = '';

  $: activeViewId = roomStore.activeViewId;
  $: activeRooms = roomStore.activeRoomIds.map((id) => roomStore.rooms[id]).filter(Boolean);
  $: allRooms = roomStore.roomOrder.map((id) => roomStore.rooms[id]).filter(Boolean);
  $: activeRoom = activeViewId === 'mainline' ? activeRooms[0] ?? allRooms[0] : roomStore.rooms[activeViewId];
  $: leftPanelCollapsed = activeRoom?.ui.leftPanelCollapsed ?? false;
  $: rightPanelCollapsed = activeRoom?.ui.rightPanelCollapsed ?? false;
  $: collapsed = activeRoom?.ui.collapsedSections ?? { blueprint: false, wp: false, pr: false, task: false, gate: false };
  $: activeSnapshot = snapshotForConversation(chatgptSnapshots, activeRoom?.gptConversationBinding ?? null);
  $: boundRoomCount = allRooms.filter((room) => Boolean(room.gptConversationBinding)).length;
  $: runtimeBinding = activeRoom ? roomRuntimeBinding(activeRoom.branch, activeRoom.worktree, executorFacts) : 'UNAVAILABLE';
  $: actualRepository = executorFacts?.project.value?.repository ?? null;
  $: actualExecutor = executorFacts?.executor.value ?? null;
  $: actualPrDelivery = executorFacts?.prDelivery.value ?? null;

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
    const refreshFacts = async () => {
      try {
        const facts = await readExecutorFacts();
        if (cancelled) return;
        executorFacts = facts;
        executorFactsError = '';
      } catch (error) {
        if (cancelled) return;
        executorFactsError = error instanceof Error ? error.message : String(error);
      }
    };
    void refreshProjection();
    void refreshFacts();
    const projectionTimer = window.setInterval(() => void refreshProjection(), 1800);
    const factsTimer = window.setInterval(() => void refreshFacts(), 6000);
    return () => { cancelled = true; window.clearInterval(projectionTimer); window.clearInterval(factsTimer); };
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

  function shortSha(value: string | null | undefined) { return value ? value.slice(0, 8) : 'UNAVAILABLE'; }
  function ciSummary() {
    if (!executorFacts?.prDelivery.available || !actualPrDelivery) return executorFacts?.prDelivery.errorCode ?? 'UNAVAILABLE';
    const checks = actualPrDelivery.checks;
    if (!checks.length) return 'NO CHECKS';
    const passed = checks.filter((check) => check.conclusion === 'success').length;
    const failed = checks.filter((check) => check.conclusion === 'failure').length;
    const running = checks.filter((check) => check.status !== 'completed').length;
    return `${passed} PASS · ${failed} FAIL · ${running} RUNNING`;
  }
  function prSummary() {
    if (!executorFacts?.prDelivery.available || !actualPrDelivery) return executorFacts?.prDelivery.errorCode ?? 'UNAVAILABLE';
    const open = actualPrDelivery.pullRequests[0];
    return open ? `#${open.number} · ${open.isDraft ? 'DRAFT' : open.state}` : 'NONE';
  }
  function runSummary() {
    const run = actualExecutor?.latestRun as Record<string, unknown> | null | undefined;
    if (!run) return 'IDLE';
    const runId = typeof run.runId === 'string' ? run.runId.slice(0, 8) : 'UNKNOWN';
    const state = typeof run.state === 'string' ? run.state : 'UNKNOWN';
    return `${runId} · ${state}`;
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
    <div class="header-status"><span class="status-dot"></span><span>V5.3 · Real Executor Facts · {activeRooms.length} / {MAX_ACTIVE_ROOMS} ACTIVE</span></div>
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
          <span class="shell-badge">V5.3 Real Executor Facts · 真实执行事实</span>
        </section>

        <section class="mainline-kpis">
          <article><span>当前阶段</span><strong>V5.3</strong><small>Real Executor Facts</small></article>
          <article><span>Active Rooms</span><strong>{activeRooms.length} / {MAX_ACTIVE_ROOMS}</strong><small>状态层硬限制</small></article>
          <article><span>GPT Bindings</span><strong>{boundRoomCount} / {allRooms.length}</strong><small>每个 Room 独立 conversationId</small></article>
          <article><span>Detected GPT</span><strong>{chatgptSnapshots.length}</strong><small>Profile 12 实时 snapshot</small></article>
          <article><span>V5.2</span><strong>MERGED</strong><small>main@42a67a8</small></article>
        </section>

        <section class="mainline-card">
          <div class="mainline-section-heading"><div><h2>完整主线进度视图</h2><p>V5 Roadmap · 从产品方向到多 Room Managed Execution</p></div><span class="mini-progress">V5.3 FACTS</span></div>
          <div class="stage-flow">
            <div class="stage done"><b>✓</b><strong>Blueprint</strong><span>产品方向冻结</span><i><em style="width:100%"></em></i><small>100%</small></div>
            <div class="stage done"><b>✓</b><strong>V5.0 Shell</strong><span>PR #26 已合并</span><i><em style="width:100%"></em></i><small>100%</small></div>
            <div class="stage done"><b>✓</b><strong>V5.1 Isolation</strong><span>PR #27 已合并</span><i><em style="width:100%"></em></i><small>100%</small></div>
            <div class="stage done"><b>✓</b><strong>V5.2 GPT</strong><span>PR #28 已合并</span><i><em style="width:100%"></em></i><small>100%</small></div>
            <div class="stage current"><b>●</b><strong>V5.3 Facts</strong><span>Real Executor Facts</span><i><em style="width:55%"></em></i><small>55%</small></div>
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
              <div class="gate-row current"><span>●</span><div><strong>V5.3 Executor Facts Gate</strong><small>Project / Git / PR / CI / Codex 全部来自真实 backend facts</small></div><b>UAT NEXT</b></div>
              <div class="gate-row"><span>○</span><div><strong>V5.4 Closed Loop Gate</strong><small>GPT exact task → managed executor → GitHub → GPT review</small></div><b>LATER</b></div>
              <div class="gate-row"><span>○</span><div><strong>V5.5 Hardening Gate</strong><small>多 Room 恢复、资源上限、异常恢复</small></div><b>LATER</b></div>
            </div>
          </article>
          <article class="mainline-card">
            <div class="mainline-section-heading"><div><h2>V5.3 Source of Truth</h2><p>GitHub 仍是代码 / PR / CI 唯一事实源；右栏只展示 backend 实时读取结果</p></div></div>
            <div class="mainline-facts">
              <div><span>Base SHA</span><strong>42a67a8</strong></div>
              <div><span>V5.3 Branch</span><strong>feat/aicc-v5-real-executor-facts</strong></div>
              <div><span>Runtime Branch</span><strong>{actualRepository?.branch ?? 'UNAVAILABLE'}</strong></div>
              <div><span>Runtime HEAD</span><strong>{shortSha(actualRepository?.head)}</strong></div>
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
            <span class="phase-pill">V5.3</span>
          </div>

          <div class="roadmap-title-row">
            <div><strong>支线进度</strong><span>{activeRoom.projectId} / {activeRoom.workstreamId}</span></div>
            <span class="mini-progress">Real Facts</span>
          </div>

          <div class="roadmap-groups">
            <section class="roadmap-group">
              <button class="group-toggle" type="button" onclick={() => toggle('blueprint')}><span>Blueprint · 蓝图</span><b>1 / 1</b><i>{collapsed.blueprint ? '›' : '⌄'}</i></button>
              {#if !collapsed.blueprint}<div class="roadmap-item done"><span>✓</span><div><strong>V5 产品方向冻结</strong><small>Multi-Execution Workbench</small></div></div>{/if}
            </section>

            <section class="roadmap-group">
              <button class="group-toggle" type="button" onclick={() => toggle('wp')}><span>WP · 工作包</span><b>1 / 1</b><i>{collapsed.wp ? '›' : '⌄'}</i></button>
              {#if !collapsed.wp}<div class="roadmap-item current"><span>●</span><div><strong>V5.3 — Real Executor Facts</strong><small>Project / Git / PR / CI / Codex live facts</small></div></div>{/if}
            </section>

            <section class="roadmap-group">
              <button class="group-toggle" type="button" onclick={() => toggle('pr')}><span>PR · 需求与计划</span><b>0 / 1</b><i>{collapsed.pr ? '›' : '⌄'}</i></button>
              {#if !collapsed.pr}<div class="roadmap-item pending"><span>○</span><div><strong>V5.3 Real Executor Facts PR</strong><small>Facts UAT 后才进入 PR Gate</small></div></div>{/if}
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
              {#if !collapsed.gate}<div class="roadmap-item current"><span>●</span><div><strong>V5.3 Real Executor Facts Gate</strong><small>PASS 后才能进入 V5.4 Closed Loop</small></div></div>{/if}
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
          <div class="composer-input"><span class="composer-plus">＋</span><input class="composer-draft" style="width:100%;border:0;outline:0;background:transparent;color:#111;font:inherit;" value={activeRoom.ui.draft} oninput={updateDraft} placeholder="V5.3 本地草稿 · 真实发送仍受 Owner authorization Gate 控制" /><span class="composer-mic">⌁</span></div>
          <button class="next-step-button" type="button" onclick={() => announce('V5.3 STOP Gate：当前只做真实 Executor Facts；自动推进在 V5.4 Closed Loop Gate 接入')}>推进下一步</button>
        </div>
      </main>

      <aside class="facts-panel">
        <button class="panel-collapse panel-collapse-right" type="button" aria-label={rightPanelCollapsed ? '展开右侧事实' : '收起右侧事实'} onclick={toggleRightPanel}>{rightPanelCollapsed ? '‹' : '›'}</button>
        {#if !rightPanelCollapsed}
          <div class="panel-heading facts-heading">
            <div><span class="eyebrow">Real Executor Facts</span><h2>执行详情</h2></div>
            <span class:fact-drift={runtimeBinding === 'DRIFT'} class:fact-ready={runtimeBinding === 'MATCH'} class="live-pill"><i></i>{runtimeBinding}</span>
          </div>

          <div class="fact-stack">
            <div class="fact-row"><span>Room Expected Branch</span><strong>{activeRoom.branch}</strong></div>
            <div class="fact-row"><span>Room Expected Worktree</span><strong>{activeRoom.worktree}</strong></div>
            <div class="fact-row"><span>Runtime Repository</span><strong>{actualRepository?.identity ?? executorFacts?.project.errorCode ?? 'UNAVAILABLE'}</strong></div>
            <div class="fact-row"><span>Actual Branch</span><strong>{actualRepository?.branch ?? 'UNAVAILABLE'}</strong></div>
            <div class="fact-row"><span>Actual Worktree</span><strong>{actualRepository?.path ?? 'UNAVAILABLE'}</strong></div>
            <div class="fact-row"><span>HEAD</span><strong class="mono">{shortSha(actualRepository?.head)}</strong></div>
            <div class="fact-row"><span>Worktree</span><strong>{actualRepository ? (actualRepository.dirty ? 'DIRTY' : 'CLEAN') : 'UNAVAILABLE'}</strong></div>
            <div class="fact-row"><span>Remote Head</span><strong class="mono">{shortSha(actualPrDelivery?.origin.remoteHeadSha)}</strong></div>
            <div class="fact-row"><span>Pull Request</span><strong>{prSummary()}</strong></div>
            <div class="fact-row"><span>CI · exact HEAD</span><strong>{ciSummary()}</strong></div>
            <div class="fact-row"><span>Codex</span><strong>{actualExecutor ? (actualExecutor.readiness.ready ? `READY · ${actualExecutor.readiness.version ?? 'version unknown'}${actualExecutor.readiness.doctorStatus && actualExecutor.readiness.doctorStatus !== 'ok' ? ` · ${actualExecutor.readiness.doctorStatus.toUpperCase()}` : ''}` : actualExecutor.readiness.errorCode ?? 'NOT READY') : executorFacts?.executor.errorCode ?? 'UNAVAILABLE'}</strong></div>
            <div class="fact-row"><span>Codex Diagnostics</span><strong>{actualExecutor?.readiness.diagnostics?.length ? actualExecutor.readiness.diagnostics.map((item) => `${item.id}:${item.status}`).join(' · ') : actualExecutor?.readiness.ready ? 'NONE' : 'UNAVAILABLE'}</strong></div>
            <div class="fact-row"><span>Active Run</span><strong>{actualExecutor?.activeLease?.runId ? actualExecutor.activeLease.runId.slice(0, 8) : 'IDLE'}</strong></div>
            <div class="fact-row"><span>Latest Run</span><strong>{runSummary()}</strong></div>
            <div class="fact-row"><span>GPT Conversation</span><strong>{activeRoom.gptConversationBinding ?? 'UNBOUND'}</strong></div>
          </div>

          <div class="log-block">
            <div class="log-heading"><strong>V5.3 Fact Sources</strong><span>{executorFacts ? capturedLabel(executorFacts.capturedAt) : 'WAITING'}</span></div>
            <div class="log-line"><span>GIT</span><p>{executorFacts?.project.available ? `LIVE · ${actualRepository?.branch} @ ${shortSha(actualRepository?.head)}` : executorFacts?.project.errorCode ?? 'WAITING'}</p></div>
            <div class="log-line"><span>PR/CI</span><p>{executorFacts?.prDelivery.available ? `${prSummary()} · ${ciSummary()}` : executorFacts?.prDelivery.errorCode ?? 'WAITING'}</p></div>
            <div class="log-line"><span>CODEX</span><p>{executorFacts?.executor.available ? (actualExecutor?.readiness.ready ? `READY · required checks healthy${actualExecutor.readiness.doctorStatus && actualExecutor.readiness.doctorStatus !== 'ok' ? ` · doctor ${actualExecutor.readiness.doctorStatus}` : ''}` : actualExecutor?.readiness.errorCode ?? 'NOT READY') : executorFacts?.executor.errorCode ?? 'WAITING'}</p></div>
            <div class="log-line"><span>WORK</span><p>{executorFacts?.work.available ? `${executorFacts.work.value?.workPackages.length ?? 0} WP · ${executorFacts.work.value?.tasks.length ?? 0} Task` : executorFacts?.work.errorCode ?? 'WAITING'}</p></div>
            <div class="log-line current"><span>ROOM</span><p>{runtimeBinding === 'MATCH' ? 'MATCH · Room 与 runtime exact binding 一致' : runtimeBinding === 'DRIFT' ? 'DRIFT · 当前 Room 声明与 runtime 事实不一致，禁止冒充 MATCH' : 'UNAVAILABLE · 尚无 runtime 事实'}</p></div>
          </div>

          <div class="facts-note"><strong>GitHub / Runtime = Executor Source of Truth</strong><p>右栏不再显示静态执行占位。Project / Git / PR / CI / Codex 均由 backend 实时读取；任何 source 不可用都会显式 fail-closed。{executorFactsError ? ` · ${executorFactsError}` : ''}</p></div>
        {/if}
      </aside>
    </section>
  {/if}

  {#if toast}<div class="toast" role="status">{toast}</div>{/if}
</div>
