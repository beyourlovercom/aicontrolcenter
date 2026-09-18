<script lang="ts">
  import { onMount } from 'svelte';
  import {
    bindGptConversation,
    closeExecutionRoom,
    createDefaultExecutionRoomStore,
    createExecutionRoom,
    createExternalExecutionRoomState,
    loadExecutionRoomStore,
    patchExecutionRoomUi,
    persistExecutionRoomStore,
    reopenExecutionRoom,
    refreshExternalRoomRuntime,
    selectExecutionRoom,
    selectMainline as selectMainlineView,
    toggleRoadmapSection,
    unbindGptConversation,
    updateExecutionRoom,
    type ExecutionRoomState,
    type ExecutionRoomStore,
    type RoadmapSection
  } from './lib/executionRoomState';
  import { readChatgptSnapshots, snapshotForConversation, type ChatgptConversationSnapshot } from './lib/chatgptProjection';
  import { readExecutorFacts, readRoomExecutorFacts, roomRuntimeBinding, type ExecutorFactsProjection } from './lib/executorFacts';
  import { cancelPendingNextStepForRoom, nextStepEligibility, nextStepStatusLabel, readNextStep, submitNextStep, type NextStepProjection } from './lib/nextStep';
  import { resolveProviderDecision } from './lib/providerPresentation';
  import { projectRoomProgress } from './lib/roomProgress';
  import { readExternalProjects, type ExternalProjectCatalog } from './lib/externalProjects';

  let roomStore: ExecutionRoomStore = createDefaultExecutionRoomStore();
  let toast = '';
  let chatgptSnapshots: ChatgptConversationSnapshot[] = [];
  let projectionError = '';
  let globalExecutorFacts: ExecutorFactsProjection | null = null;
  let roomExecutorFacts: Record<string, ExecutorFactsProjection> = {};
  let roomExecutorErrors: Record<string, string> = {};
  let factsRefreshKey = '';
  const factsRefreshInFlight = new Set<string>();
  let nextSteps: Record<string, NextStepProjection> = {};
  let nextStepBusyRoomId: string | null = null;

  let projectPickerOpen = false;
  let projectPickerBusy = false;
  let externalCatalog: ExternalProjectCatalog | null = null;
  let externalProjectError = '';
  let selectedExternalProjectId = '';
  let selectedExternalWorkstreamId = '';
  let selectedExternalRuntimePath = '';

  $: activeViewId = roomStore.activeViewId;
  $: activeRooms = roomStore.activeRoomIds.map((id) => roomStore.rooms[id]).filter(Boolean);
  $: allRooms = roomStore.roomOrder.map((id) => roomStore.rooms[id]).filter(Boolean);
  $: activeRoom = activeViewId === 'mainline' ? activeRooms[0] ?? allRooms[0] : roomStore.rooms[activeViewId];
  $: leftPanelCollapsed = activeRoom?.ui.leftPanelCollapsed ?? false;
  $: rightPanelCollapsed = activeRoom?.ui.rightPanelCollapsed ?? false;
  $: collapsed = activeRoom?.ui.collapsedSections ?? { blueprint: false, wp: false, pr: false, task: false, gate: false };
  $: activeSnapshot = snapshotForConversation(chatgptSnapshots, activeRoom?.gptConversationBinding ?? null);
  $: boundRoomCount = allRooms.filter((room) => Boolean(room.gptConversationBinding)).length;
  $: executorFacts = activeRoom && activeRoom.repo !== 'PENDING_PROJECT_REPO_BINDING' ? (roomExecutorFacts[activeRoom.roomId] ?? null) : globalExecutorFacts;
  $: executorFactsError = activeRoom ? (roomExecutorErrors[activeRoom.roomId] ?? '') : '';
  $: runtimeBinding = activeRoom ? roomRuntimeBinding(activeRoom.branch, activeRoom.worktree, executorFacts, activeRoom.baseSha) : 'UNAVAILABLE';
  $: actualRepository = executorFacts?.project.value?.repository ?? null;
  $: actualExecutor = executorFacts?.executor.value ?? null;
  $: actualPrDelivery = executorFacts?.prDelivery.value ?? null;
  $: activeCanonicalRefresh = activeRoom?.canonicalRefresh ?? null;
  $: activeNextStep = activeRoom ? nextSteps[activeRoom.roomId] ?? null : null;
  $: activeProviderDecision = resolveProviderDecision(activeNextStep?.state.decision ?? null);
  $: roomProgress = activeRoom ? projectRoomProgress(activeRoom, executorFacts, activeNextStep, runtimeBinding) : null;
  $: activeNextStepEligibility = activeRoom ? nextStepEligibility(activeRoom, executorFacts, activeSnapshot) : { ready: false, blockers: ['ROOM_UNAVAILABLE'] };
  $: nextStepLocked = !activeNextStepEligibility.ready || nextStepBusyRoomId === activeRoom?.roomId || ['PENDING','CLAIMED'].includes(activeNextStep?.state.state ?? '');
  $: selectedExternalProject = externalCatalog?.projects.find((project) => project.id === selectedExternalProjectId) ?? null;
  $: selectedExternalWorkstream = selectedExternalProject?.workstreams.find((workstream) => workstream.id === selectedExternalWorkstreamId) ?? null;
  $: selectedExternalRuntime = selectedExternalWorkstream?.runtimes.find((runtime) => runtime.path === selectedExternalRuntimePath) ?? null;
  $: {
    const key = activeRoom ? `${activeRoom.roomId}\0${activeRoom.projectId}\0${activeRoom.repo}\0${activeRoom.worktree}` : '';
    if (typeof window !== 'undefined' && key && key !== factsRefreshKey) { factsRefreshKey = key; window.setTimeout(() => window.dispatchEvent(new CustomEvent('aicc-v55-refresh-facts')), 0); }
  }

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
      const viewId = roomStore.activeViewId;
      const room = viewId === 'mainline'
        ? roomStore.activeRoomIds.map((id) => roomStore.rooms[id]).find(Boolean) ?? null
        : roomStore.rooms[viewId] ?? null;
      if (!room) return;
      if (factsRefreshInFlight.has(room.roomId)) return;
      factsRefreshInFlight.add(room.roomId);
      try {
        if (room.repo !== 'PENDING_PROJECT_REPO_BINDING') {
          const localNextStep = nextSteps[room.roomId];
          const busyNextStep = ['PENDING','CLAIMED'].includes(localNextStep?.state.state ?? '');
          const activeLease = roomExecutorFacts[room.roomId]?.executor.value?.activeLease?.runId ?? null;
          if (!busyNextStep && !activeLease) {
            const catalog = await readExternalProjects();
            if (cancelled) return;
            externalCatalog = catalog;
            const refreshed = refreshExternalRoomRuntime(roomStore, room.roomId, catalog);
            if (refreshed.changed) {
              const pending = await cancelPendingNextStepForRoom(room.roomId);
              if (cancelled) return;
              if (pending.claimed.length) {
                roomExecutorErrors = {...roomExecutorErrors,[room.roomId]:'CANONICAL_REFRESH_BLOCKED_BY_CLAIMED_NEXT_STEP'};
                return;
              }
              commit(refreshed.store);
              const { [room.roomId]: _facts, ...remainingFacts } = roomExecutorFacts;
              roomExecutorFacts = remainingFacts;
              const { [room.roomId]: _error, ...remainingErrors } = roomExecutorErrors;
              roomExecutorErrors = remainingErrors;
              if (nextSteps[room.roomId] || pending.cancelled.length) {
                const { [room.roomId]: _stale, ...rest } = nextSteps;
                nextSteps = rest;
              }
              const updated = refreshed.store.rooms[room.roomId];
              announce(`Room canonical 已刷新：${updated.branch} @ ${shortSha(updated.baseSha)}`);
              window.setTimeout(() => window.dispatchEvent(new CustomEvent('aicc-v55-refresh-facts')), 0);
              return;
            }
          }
        }
        if (room.repo === 'PENDING_PROJECT_REPO_BINDING') {
          const facts = await readExecutorFacts();
          if (cancelled) return;
          globalExecutorFacts = facts;
        } else {
          const facts = await readRoomExecutorFacts({projectId:room.projectId,projectName:room.name,repositoryIdentity:room.repo,repositoryPath:room.worktree,roomId:room.roomId,workstreamId:room.workstreamId});
          if (cancelled) return;
          roomExecutorFacts = {...roomExecutorFacts,[room.roomId]:facts};
        }
        roomExecutorErrors = {...roomExecutorErrors,[room.roomId]:''};
      } catch (error) {
        if (cancelled) return;
        roomExecutorErrors = {...roomExecutorErrors,[room.roomId]:error instanceof Error ? error.message : String(error)};
      } finally {
        factsRefreshInFlight.delete(room.roomId);
      }
    };
    const refreshFactsListener = () => void refreshFacts();
    window.addEventListener('aicc-v55-refresh-facts', refreshFactsListener);
    void refreshProjection();
    void refreshFacts();
    const projectionTimer = window.setInterval(() => void refreshProjection(), 1800);
    const factsTimer = window.setInterval(() => void refreshFacts(), 6000);
    return () => { cancelled = true; window.removeEventListener('aicc-v55-refresh-facts', refreshFactsListener); window.clearInterval(projectionTimer); window.clearInterval(factsTimer); };
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

  async function closeRoom(event: Event, id: string) {
    event.stopPropagation();
    const local = nextSteps[id];
    if (local?.state.state === 'CLAIMED') { announce('ROOM_CLAIMED · GPT planner 已领取请求，当前 Room 不可关闭。'); return; }
    try {
      const result = await cancelPendingNextStepForRoom(id);
      if (result.claimed.length) { announce('ROOM_CLAIMED · backend 已有 planner claim，当前 Room 不可关闭。'); return; }
      if (result.cancelled.length) nextSteps = { ...nextSteps, [id]: { ...(local as NextStepProjection), state: { ...(local?.state ?? {}), state: 'ABORTED_BEFORE_SEND', errorCode: 'NEXT_STEP_ROOM_INACTIVE' } } as NextStepProjection };
      commit(closeExecutionRoom(roomStore, id));
    } catch (error) { announce(error instanceof Error ? error.message : String(error)); }
  }

  function openOrReopenRoom(id: string) {
    try {
      if (roomStore.activeRoomIds.includes(id)) commit(selectExecutionRoom(roomStore, id));
      else commit(reopenExecutionRoom(roomStore, id));
    } catch (error) {
      announce(error instanceof Error ? error.message : String(error));
    }
  }

  function chooseFirstExternalRuntime(projectId: string, workstreamId?: string) {
    const project = externalCatalog?.projects.find((item) => item.id === projectId) ?? null;
    const workstream = project?.workstreams.find((item) => item.id === workstreamId) ?? project?.workstreams[0] ?? null;
    selectedExternalProjectId = project?.id ?? '';
    selectedExternalWorkstreamId = workstream?.id ?? '';
    selectedExternalRuntimePath = workstream?.runtimes.find((runtime) => runtime.executable)?.path ?? workstream?.runtimes[0]?.path ?? '';
  }

  async function addOrReopenRoom() {
    projectPickerOpen = true;
    projectPickerBusy = true;
    externalProjectError = '';
    try {
      externalCatalog = await readExternalProjects();
      if (!externalCatalog.projects.length) externalProjectError = 'EXTERNAL_PROJECT_REGISTRY_EMPTY';
      else chooseFirstExternalRuntime(externalCatalog.projects[0].id);
    } catch (error) {
      externalProjectError = error instanceof Error ? error.message : String(error);
    } finally {
      projectPickerBusy = false;
    }
  }

  function selectExternalProject(event: Event) {
    chooseFirstExternalRuntime((event.currentTarget as HTMLSelectElement).value);
  }

  function selectExternalWorkstream(event: Event) {
    chooseFirstExternalRuntime(selectedExternalProjectId, (event.currentTarget as HTMLSelectElement).value);
  }

  function selectExternalRuntime(event: Event) {
    selectedExternalRuntimePath = (event.currentTarget as HTMLSelectElement).value;
  }

  function closeProjectPicker() { projectPickerOpen = false; }

  function createExternalRoomFromSelection() {
    const project = selectedExternalProject, workstream = selectedExternalWorkstream, runtime = selectedExternalRuntime;
    if (!project || !workstream || !runtime || !runtime.executable || !runtime.branch) {
      announce('EXTERNAL_RUNTIME_NOT_EXECUTABLE · 请选择 CLEAN 且非 detached 的 worktree。');
      return;
    }
    const existing = allRooms.find((room) => room.projectId === project.id && room.workstreamId === workstream.id && room.worktree === runtime.path);
    if (existing) {
      projectPickerOpen = false;
      openOrReopenRoom(existing.roomId);
      announce(`已恢复 ${existing.name}`);
      return;
    }
    const slug = `${project.id}-${workstream.id}-${runtime.head.slice(0, 8)}`.replace(/[^a-zA-Z0-9_-]/g, '-');
    const room = createExternalExecutionRoomState({
      roomId: `ext-${slug}`,
      name: workstream.name,
      projectId: project.id,
      workstreamId: workstream.id,
      repositoryIdentity: project.repositoryIdentity,
      branch: runtime.branch,
      worktree: runtime.path,
      head: runtime.head
    });
    try {
      commit(createExecutionRoom(roomStore, room));
      projectPickerOpen = false;
      announce(`已创建 ${room.name} · ${room.branch}`);
    } catch (error) {
      announce(error instanceof Error ? error.message : String(error));
    }
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

  function adoptCurrentRuntime() {
    if (!activeRoom || !actualRepository) return;
    commit(updateExecutionRoom(roomStore, activeRoom.roomId, (room) => ({
      ...room, repo: actualRepository.identity, branch: actualRepository.branch, worktree: actualRepository.path, baseSha: actualRepository.head
    })));
    announce(`Room 已采用真实 Runtime：${actualRepository.branch} @ ${shortSha(actualRepository.head)}`);
  }

  function setNextStep(roomId: string, projection: NextStepProjection) {
    nextSteps = { ...nextSteps, [roomId]: projection };
  }

  async function watchNextStep(roomId: string, requestId: string) {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
      try {
        const projection = await readNextStep(requestId); setNextStep(roomId, projection);
        if (projection.state.state === 'EXECUTION_QUEUED') {
          window.dispatchEvent(new CustomEvent('aicc-v55-refresh-facts'));
          announce(nextStepStatusLabel(projection));
          return;
        }
        if (!['PENDING','CLAIMED'].includes(projection.state.state)) {
          window.dispatchEvent(new CustomEvent('aicc-v55-refresh-facts'));
          announce(nextStepStatusLabel(projection)); return;
        }
      } catch (error) {
        announce(error instanceof Error ? error.message : String(error)); return;
      }
    }
    announce('NEXT_STEP_WATCH_TIMEOUT · 请求仍保留在 backend，不会自动重放。');
  }

  async function submitActiveNextStep(draft: string, clearDraftAfterFreeze = false, ownerCommand = false) {
    if (!activeRoom || nextStepBusyRoomId) return;
    const room = activeRoom;
    const gate = nextStepEligibility(room, executorFacts, activeSnapshot);
    if (!gate.ready) { announce(`Next-Step blocked：${gate.blockers.join(' · ')}`); return; }
    const roomId = room.roomId; nextStepBusyRoomId = roomId;
    try {
      const projection = await submitNextStep(room, draft); setNextStep(roomId, projection);
      if (clearDraftAfterFreeze) commit(patchExecutionRoomUi(roomStore, roomId, { draft: '' }));
      announce(ownerCommand ? 'Owner 指令已冻结 · 等待 Profile 12 GPT planner' : 'Next-Step 已冻结 · 等待 Profile 12 GPT planner');
      void watchNextStep(roomId, projection.request.requestId);
    } catch (error) {
      announce(error instanceof Error ? error.message : String(error));
    } finally { nextStepBusyRoomId = null; }
  }

  async function advanceNextStep() {
    if (!activeRoom) return;
    await submitActiveNextStep(activeRoom.ui.draft);
  }

  async function submitOwnerCommand() {
    if (!activeRoom || !activeRoom.ui.draft.trim() || nextStepLocked) return;
    await submitActiveNextStep(activeRoom.ui.draft, true, true);
  }

  function ownerCommandKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    void submitOwnerCommand();
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
    <div class="header-status"><span class="status-dot"></span><span>V5.5 · Multi-Room Hardening · {activeRooms.length} Rooms</span></div>
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

  {#if projectPickerOpen}
    <div class="external-project-backdrop" role="presentation">
      <div class="external-project-dialog" role="dialog" aria-modal="true" aria-label="新建 Execution Room">
        <div class="external-project-dialog-head">
          <div><span class="eyebrow">External Project Loading V1</span><h2>新建 Execution Room</h2><p>选择真实项目与 CLEAN worktree；创建后会冻结 exact branch / HEAD。</p></div>
          <button type="button" class="dialog-close" onclick={closeProjectPicker}>×</button>
        </div>
        {#if projectPickerBusy}
          <div class="external-project-loading">正在读取 Project Registry 与 Git worktrees…</div>
        {:else if externalProjectError}
          <div class="external-project-error">{externalProjectError}</div>
        {:else if externalCatalog}
          <div class="external-project-form">
            <label><span>项目</span><select value={selectedExternalProjectId} onchange={selectExternalProject}>{#each externalCatalog.projects as project}<option value={project.id}>{project.name} · {project.repositoryIdentity}</option>{/each}</select></label>
            <label><span>工作流</span><select value={selectedExternalWorkstreamId} onchange={selectExternalWorkstream}>{#each selectedExternalProject?.workstreams ?? [] as workstream}<option value={workstream.id}>{workstream.name}</option>{/each}</select></label>
            <label><span>Runtime / Worktree</span><select value={selectedExternalRuntimePath} onchange={selectExternalRuntime}>{#each selectedExternalWorkstream?.runtimes ?? [] as runtime}<option value={runtime.path} disabled={!runtime.executable}>{runtime.executable ? 'CLEAN' : runtime.dirty ? 'DIRTY' : 'BLOCKED'} · {runtime.branch ?? 'DETACHED'} · {runtime.head.slice(0, 8)}</option>{/each}</select></label>
          </div>
          {#if selectedExternalRuntime}
            <div class="external-runtime-preview">
              <div><span>Repository</span><strong>{selectedExternalProject?.repositoryIdentity}</strong></div>
              <div><span>Branch</span><strong>{selectedExternalRuntime.branch ?? 'DETACHED'}</strong></div>
              <div><span>HEAD</span><strong>{selectedExternalRuntime.head}</strong></div>
              <div><span>Worktree</span><strong>{selectedExternalRuntime.path}</strong></div>
              <div><span>Gate</span><strong class:runtime-blocked={!selectedExternalRuntime.executable}>{selectedExternalRuntime.executable ? 'CLEAN · EXECUTABLE' : 'BLOCKED'}</strong></div>
            </div>
          {/if}
          <div class="external-project-actions"><button type="button" class="binding-link" onclick={closeProjectPicker}>取消</button><button type="button" class="next-step-button" disabled={!selectedExternalRuntime?.executable} onclick={createExternalRoomFromSelection}>创建 Room</button></div>
        {/if}
      </div>
    </div>
  {/if}

  {#if activeViewId === 'mainline'}
    <main class="mainline-panel">
      <div class="mainline-scroll">
        <section class="mainline-hero">
          <div><span class="eyebrow">Always-on Mainline View</span><h1>主线面板</h1><p>完整查看 AICC V5 从 Blueprint 到 Gate 的整体推进，并从这里恢复或切换任一 Execution Room。</p></div>
          <span class="shell-badge">V5.5 Multi-Room Hardening · Room 独立执行</span>
        </section>

        <section class="mainline-kpis">
          <article><span>当前阶段</span><strong>V5.5</strong><small>Multi-Room Hardening</small></article>
          <article><span>Open Rooms</span><strong>{activeRooms.length}</strong><small>Room / Tab 不设硬上限</small></article>
          <article><span>GPT Bindings</span><strong>{boundRoomCount} / {allRooms.length}</strong><small>每个 Room 独立 conversationId</small></article>
          <article><span>Detected GPT</span><strong>{chatgptSnapshots.length}</strong><small>Profile 12 实时 snapshot</small></article>
          <article><span>V5.4</span><strong>MERGED</strong><small>main@ba223d2</small></article>
        </section>

        <section class="mainline-card">
          <div class="mainline-section-heading"><div><h2>完整主线进度视图</h2><p>V5 Roadmap · 从产品方向到多 Room Managed Execution</p></div><span class="mini-progress">V5.5 MULTI-ROOM</span></div>
          <div class="stage-flow">
            <div class="stage done"><b>✓</b><strong>Blueprint</strong><span>产品方向冻结</span><i><em style="width:100%"></em></i><small>100%</small></div>
            <div class="stage done"><b>✓</b><strong>V5.0 Shell</strong><span>PR #26 已合并</span><i><em style="width:100%"></em></i><small>100%</small></div>
            <div class="stage done"><b>✓</b><strong>V5.1 Isolation</strong><span>PR #27 已合并</span><i><em style="width:100%"></em></i><small>100%</small></div>
            <div class="stage done"><b>✓</b><strong>V5.2 GPT</strong><span>PR #28 已合并</span><i><em style="width:100%"></em></i><small>100%</small></div>
            <div class="stage done"><b>✓</b><strong>V5.3 Facts</strong><span>PR #29 已合并</span><i><em style="width:100%"></em></i><small>100%</small></div>
            <div class="stage done"><b>✓</b><strong>V5.4 Loop</strong><span>PR #30 已合并</span><i><em style="width:100%"></em></i><small>100%</small></div>
            <div class="stage current"><b>●</b><strong>V5.5 Multi-Room</strong><span>Runtime / Run / GPT isolation</span><i><em style="width:80%"></em></i><small>80%</small></div>
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
              <div class="gate-row"><span>✓</span><div><strong>V5.3 Executor Facts Gate</strong><small>Owner UAT PASS · PR #29 merged</small></div><b>DONE</b></div>
              <div class="gate-row"><span>✓</span><div><strong>V5.4 Closed Loop Gate</strong><small>Owner UAT PASS · PR #30 merged</small></div><b>DONE</b></div>
              <div class="gate-row current"><span>●</span><div><strong>V5.5 Hardening Gate</strong><small>多 Room runtime / GPT / Run / recovery 隔离</small></div><b>UAT NEXT</b></div>
            </div>
          </article>
          <article class="mainline-card">
            <div class="mainline-section-heading"><div><h2>V5.5 Runtime Isolation</h2><p>GitHub 仍是唯一代码事实源；每个 Room 独立读取 exact worktree / Run / GPT Facts</p></div></div>
            <div class="mainline-facts">
              <div><span>Base SHA</span><strong>ba223d2</strong></div>
              <div><span>V5.5 Branch</span><strong>feat/aicc-v5-multi-room-hardening</strong></div>
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
            <span class="phase-pill">V5.5</span>
          </div>

          <div class="roadmap-title-row">
            <div><strong>支线进度</strong><span>{activeRoom.projectId} / {activeRoom.workstreamId}</span></div>
            <span class="mini-progress">Multi-Room</span>
          </div>

          <div class="roadmap-groups">
            {#each [['blueprint','Blueprint · 蓝图',roomProgress?.blueprint ?? []],['wp','WP · 工作包',roomProgress?.workPackages ?? []],['pr','PR · 需求与计划',roomProgress?.pullRequests ?? []],['task','Task · 任务执行',roomProgress?.tasks ?? []],['gate','Gate · 当前门禁',roomProgress?.gates ?? []]] as group}
              <section class="roadmap-group">
                <button class="group-toggle" type="button" onclick={() => toggle(group[0] as RoadmapSection)}><span>{group[1]}</span><b>{group[2].length}</b><i>{collapsed[group[0] as RoadmapSection] ? '›' : '⌄'}</i></button>
                {#if !collapsed[group[0] as RoadmapSection]}
                  {#each group[2] as item}
                    <div class="roadmap-item {item.state}"><span>{item.state === 'done' ? '✓' : item.state === 'current' ? '●' : item.state === 'blocked' ? '!' : '○'}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div></div>
                  {/each}
                {/if}
              </section>
            {/each}
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
          <div class="composer-input">
            <span class="composer-plus">＋</span>
            <input class="composer-draft" value={activeRoom.ui.draft} oninput={updateDraft} onkeydown={ownerCommandKeydown} placeholder="可选：补充本轮 Owner 指令；Enter 或 ↑ 确认并推进" aria-label="Owner 指令" />
            <button class="composer-send" class:composer-send-disabled={nextStepLocked || !activeRoom.ui.draft.trim()} disabled={nextStepLocked || !activeRoom.ui.draft.trim()} type="button" aria-label="确认 Owner 指令并推进下一步" title="确认 Owner 指令并推进下一步" onclick={submitOwnerCommand}>↑</button>
          </div>
          <button class="next-step-button" class:next-step-disabled={nextStepLocked} disabled={nextStepLocked} type="button" onclick={advanceNextStep}>推进下一步</button>
          <div class:next-step-blocked={!activeNextStepEligibility.ready} class="next-step-status"><strong>{nextStepStatusLabel(activeNextStep)}</strong><span>{activeNextStepEligibility.ready ? 'Exact GPT + Runtime Gate READY' : `Blocked · ${activeNextStepEligibility.blockers.join(' · ')}`}</span></div>
        </div>
      </main>

      <aside class="facts-panel">
        <button class="panel-collapse panel-collapse-right" type="button" aria-label={rightPanelCollapsed ? '展开右侧事实' : '收起右侧事实'} onclick={toggleRightPanel}>{rightPanelCollapsed ? '‹' : '›'}</button>
        {#if !rightPanelCollapsed}
          <div class="panel-heading facts-heading">
            <div><span class="eyebrow">Real Executor Facts</span><h2>执行详情</h2></div>
            <div class="facts-actions"><span class:fact-drift={runtimeBinding === 'DRIFT'} class:fact-ready={runtimeBinding === 'MATCH'} class="live-pill"><i></i>{runtimeBinding}</span>{#if runtimeBinding === 'DRIFT' && actualRepository}<button type="button" class="runtime-adopt" onclick={adoptCurrentRuntime}>采用当前 Runtime</button>{/if}</div>
          </div>

          {#if activeCanonicalRefresh}
            <div class="canonical-refresh-card">
              <div class="canonical-refresh-head"><span>Canonical refreshed</span><strong>{capturedLabel(activeCanonicalRefresh.refreshedAt)}</strong></div>
              <div class="canonical-refresh-path"><code>{activeCanonicalRefresh.fromBranch} @ {shortSha(activeCanonicalRefresh.fromHead)}</code><b>→</b><code>{activeCanonicalRefresh.toBranch} @ {shortSha(activeCanonicalRefresh.toHead)}</code></div>
              <div class="canonical-refresh-meta"><span>Conversation binding</span><strong>{activeCanonicalRefresh.conversationBindingPreserved ? 'PRESERVED' : 'UNBOUND'}</strong></div>
            </div>
          {/if}

          <div class="provider-card">
            <div class="provider-card-row"><span class="provider-label">当前执行器</span><strong class="provider-value">{activeProviderDecision ? activeProviderDecision.displayLabel : '尚未路由'}</strong></div>
            {#if activeProviderDecision?.routingReason}<div class="provider-card-row"><span class="provider-label">路由原因</span><strong class="provider-value">{activeProviderDecision.routingReason}</strong></div>{/if}
            <div class="provider-card-row"><span class="provider-label">当前状态</span><strong class="provider-value">{nextStepStatusLabel(activeNextStep)}</strong></div>
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
            <div class="fact-row"><span>Codex 就绪</span><strong>{actualExecutor ? (actualExecutor.readiness.ready ? `READY · ${actualExecutor.readiness.version ?? 'version unknown'}${actualExecutor.readiness.doctorStatus && actualExecutor.readiness.doctorStatus !== 'ok' ? ` · ${actualExecutor.readiness.doctorStatus.toUpperCase()}` : ''}` : actualExecutor.readiness.errorCode ?? 'NOT READY') : executorFacts?.executor.errorCode ?? 'UNAVAILABLE'}</strong></div>
            <div class="fact-row"><span>Codex 诊断</span><strong>{actualExecutor?.readiness.diagnostics?.length ? actualExecutor.readiness.diagnostics.map((item) => `${item.id}:${item.status}`).join(' · ') : actualExecutor?.readiness.ready ? 'NONE' : 'UNAVAILABLE'}</strong></div>
            <div class="fact-row"><span>Active Run</span><strong>{actualExecutor?.activeLease?.runId ? actualExecutor.activeLease.runId.slice(0, 8) : 'IDLE'}</strong></div>
            <div class="fact-row"><span>Latest Run</span><strong>{runSummary()}</strong></div>
            <div class="fact-row"><span>GPT Conversation</span><strong>{activeRoom.gptConversationBinding ?? 'UNBOUND'}</strong></div>
            <div class="fact-row"><span>Next-Step</span><strong>{nextStepStatusLabel(activeNextStep)}</strong></div>
          </div>

          <div class="log-block">
            <div class="log-heading"><strong>V5.5 Room Fact Sources</strong><span>{executorFacts ? capturedLabel(executorFacts.capturedAt) : 'WAITING'}</span></div>
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
