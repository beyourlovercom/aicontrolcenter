export const EXECUTION_ROOM_STORAGE_KEY = 'aicc.v5.execution-rooms.v1';
export const V5_1_BASE_SHA = '301d176cf7a10e2a9fe8f83490d9a28196a0ddde';

export type RoadmapSection = 'blueprint' | 'wp' | 'pr' | 'task' | 'gate';
export type ExecutionViewId = 'mainline' | string;
export type ExecutionRoomStatus = 'READY' | 'RUNNING' | 'WAITING' | 'UAT' | 'BLOCKED';

export type CanonicalRefreshRecord = {
  refreshedAt: string;
  fromBranch: string;
  fromWorktree: string;
  fromHead: string;
  toBranch: string;
  toWorktree: string;
  toHead: string;
  conversationBindingPreserved: boolean;
};

export type ExecutionRoomUiState = {
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  collapsedSections: Record<RoadmapSection, boolean>;
  draft: string;
};

export type ExecutionRoomState = {
  roomId: string;
  name: string;
  projectId: string;
  workstreamId: string;
  repo: string;
  baseSha: string;
  branch: string;
  worktree: string;
  gptConversationBinding: string | null;
  gptConversationUrl: string | null;
  gptConversationTitle: string | null;
  codexSession: string | null;
  runtime: string | null;
  currentWp: string;
  currentPr: string | null;
  currentTask: string;
  currentGate: string;
  status: ExecutionRoomStatus;
  nextGate: string;
  ownerUatRequired: boolean;
  canonicalRefresh: CanonicalRefreshRecord | null;
  ui: ExecutionRoomUiState;
};

export type ExecutionRoomStore = {
  version: 1;
  activeViewId: ExecutionViewId;
  activeRoomIds: string[];
  roomOrder: string[];
  rooms: Record<string, ExecutionRoomState>;
};

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type ExternalExecutionRoomInput = {
  roomId: string;
  name: string;
  projectId: string;
  workstreamId: string;
  repositoryIdentity: string;
  branch: string;
  worktree: string;
  head: string;
};

export type ExternalRuntimeCandidate = {
  path: string;
  branch: string | null;
  head: string;
  dirty: boolean;
  detached: boolean;
  executable: boolean;
  committedAt: string | null;
};

export type ExternalRoomCatalogLike = {
  projects: Array<{
    id: string;
    repositoryIdentity: string;
    workstreams: Array<{ id: string; runtimes: ExternalRuntimeCandidate[] }>;
  }>;
};

export function preferredExternalRoomRuntime(room: ExecutionRoomState, catalog: ExternalRoomCatalogLike): ExternalRuntimeCandidate | null {
  const project = catalog.projects.find((item) => item.id === room.projectId && item.repositoryIdentity === room.repo);
  const workstream = project?.workstreams.find((item) => item.id === room.workstreamId);
  if (!workstream) return null;
  return workstream.runtimes.find((runtime) => runtime.executable && Boolean(runtime.branch)) ?? null;
}

export function refreshExternalRoomRuntime(store: ExecutionRoomStore, roomId: string, catalog: ExternalRoomCatalogLike): { store: ExecutionRoomStore; changed: boolean; code: string } {
  const room = store.rooms[roomId];
  if (!room) throw new Error('ROOM_NOT_FOUND');
  const runtime = preferredExternalRoomRuntime(room, catalog);
  if (!runtime || !runtime.branch) return { store, changed: false, code: 'EXTERNAL_RUNTIME_UNAVAILABLE' };
  if (room.branch === runtime.branch && room.worktree === runtime.path && room.baseSha === runtime.head) return { store, changed: false, code: 'EXTERNAL_RUNTIME_CURRENT' };
  return {
    changed: true,
    code: 'EXTERNAL_RUNTIME_REFRESHED',
    store: updateExecutionRoom(store, roomId, (current) => ({
      ...current,
      branch: runtime.branch as string,
      worktree: runtime.path,
      baseSha: runtime.head,
      codexSession: null,
      runtime: null,
      canonicalRefresh: {
        refreshedAt: new Date().toISOString(),
        fromBranch: current.branch, fromWorktree: current.worktree, fromHead: current.baseSha,
        toBranch: runtime.branch as string, toWorktree: runtime.path, toHead: runtime.head,
        conversationBindingPreserved: Boolean(current.gptConversationBinding)
      }
    }))
  };
}

export function createExternalExecutionRoomState(input: ExternalExecutionRoomInput): ExecutionRoomState {
  for (const key of ['roomId','name','projectId','workstreamId','repositoryIdentity','branch','worktree','head'] as const) {
    if (!input[key]?.trim()) throw new Error('EXTERNAL_ROOM_INPUT_INVALID');
  }
  return {
    roomId: input.roomId.trim(),
    name: input.name.trim(),
    projectId: input.projectId.trim(),
    workstreamId: input.workstreamId.trim(),
    repo: input.repositoryIdentity.trim(),
    baseSha: input.head.trim(),
    branch: input.branch.trim(),
    worktree: input.worktree.trim(),
    gptConversationBinding: null,
    gptConversationUrl: null,
    gptConversationTitle: null,
    codexSession: null,
    runtime: null,
    currentWp: 'External Project — Runtime Binding',
    currentPr: null,
    currentTask: 'EXTERNAL_PROJECT_READY',
    currentGate: 'EXACT_RUNTIME_GATE',
    status: 'READY',
    nextGate: 'GPT_BINDING',
    ownerUatRequired: true,
    canonicalRefresh: null,
    ui: {
      leftPanelCollapsed: false,
      rightPanelCollapsed: false,
      collapsedSections: emptyCollapsedSections(),
      draft: ''
    }
  };
}

const emptyCollapsedSections = (): Record<RoadmapSection, boolean> => ({
  blueprint: false,
  wp: false,
  pr: false,
  task: false,
  gate: false
});

function room(
  roomId: string,
  name: string,
  workstreamId: string,
  branch: string,
  worktree: string
): ExecutionRoomState {
  return {
    roomId,
    name,
    projectId: 'aicc-v5-workbench',
    workstreamId,
    repo: 'PENDING_PROJECT_REPO_BINDING',
    baseSha: V5_1_BASE_SHA,
    branch,
    worktree,
    gptConversationBinding: null,
    gptConversationUrl: null,
    gptConversationTitle: null,
    codexSession: null,
    runtime: null,
    currentWp: 'V5.1 — Room State / Isolation',
    currentPr: null,
    currentTask: 'ROOM_STATE_ISOLATION',
    currentGate: 'ROOM_ISOLATION_UAT',
    status: 'READY',
    nextGate: 'V5.2 — Chrome GPT Binding',
    ownerUatRequired: true,
    canonicalRefresh: null,
    ui: {
      leftPanelCollapsed: false,
      rightPanelCollapsed: false,
      collapsedSections: emptyCollapsedSections(),
      draft: ''
    }
  };
}

export function createDefaultExecutionRoomStore(): ExecutionRoomStore {
  const defaults = [
    room('traffic', 'Traffic / Ads', 'traffic-ads', 'feature/traffic-ads', '/worktrees/traffic-ads'),
    room('inquiry', 'Inquiry OS', 'inquiry-os', 'feature/inquiry-os', '/worktrees/inquiry-os'),
    room('customer', 'Customer OS', 'customer-os', 'feature/customer-os', '/worktrees/customer-os'),
    room('product', 'Product OS', 'product-os', 'feature/product-os', '/worktrees/product-os')
  ];

  return {
    version: 1,
    activeViewId: 'traffic',
    activeRoomIds: defaults.map((item) => item.roomId),
    roomOrder: defaults.map((item) => item.roomId),
    rooms: Object.fromEntries(defaults.map((item) => [item.roomId, item]))
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function normalizeExecutionRoomStore(candidate: ExecutionRoomStore): ExecutionRoomStore {
  const roomOrder = unique(candidate.roomOrder.filter((id) => Boolean(candidate.rooms[id])));
  const activeRoomIds = unique(candidate.activeRoomIds)
    .filter((id) => Boolean(candidate.rooms[id]));
  const activeViewId = candidate.activeViewId === 'mainline' || activeRoomIds.includes(candidate.activeViewId)
    ? candidate.activeViewId
    : 'mainline';

  const rooms = Object.fromEntries(Object.entries(candidate.rooms).map(([id, roomState]) => [id, {
    ...roomState,
    gptConversationBinding: typeof roomState.gptConversationBinding === 'string' ? roomState.gptConversationBinding : null,
    gptConversationUrl: typeof roomState.gptConversationUrl === 'string' ? roomState.gptConversationUrl : null,
    gptConversationTitle: typeof roomState.gptConversationTitle === 'string' ? roomState.gptConversationTitle : null,
    canonicalRefresh: roomState.canonicalRefresh && typeof roomState.canonicalRefresh === 'object' ? roomState.canonicalRefresh : null
  }]));
  return {
    version: 1,
    activeViewId,
    activeRoomIds,
    roomOrder,
    rooms
  };
}

export function loadExecutionRoomStore(
  storage: StorageLike,
  fallback: ExecutionRoomStore = createDefaultExecutionRoomStore()
): ExecutionRoomStore {
  try {
    const raw = storage.getItem(EXECUTION_ROOM_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as ExecutionRoomStore;
    if (parsed?.version !== 1 || !parsed.rooms || !Array.isArray(parsed.activeRoomIds)) return fallback;
    return normalizeExecutionRoomStore(parsed);
  } catch {
    return fallback;
  }
}

export function persistExecutionRoomStore(storage: StorageLike, store: ExecutionRoomStore): void {
  storage.setItem(EXECUTION_ROOM_STORAGE_KEY, JSON.stringify(normalizeExecutionRoomStore(store)));
}

export function selectExecutionRoom(store: ExecutionRoomStore, roomId: string): ExecutionRoomStore {
  if (!store.activeRoomIds.includes(roomId)) throw new Error('ROOM_NOT_ACTIVE');
  return { ...store, activeViewId: roomId };
}

export function selectMainline(store: ExecutionRoomStore): ExecutionRoomStore {
  return { ...store, activeViewId: 'mainline' };
}

export function closeExecutionRoom(store: ExecutionRoomStore, roomId: string): ExecutionRoomStore {
  if (!store.rooms[roomId]) return store;
  const activeRoomIds = store.activeRoomIds.filter((id) => id !== roomId);
  return {
    ...store,
    activeRoomIds,
    activeViewId: store.activeViewId === roomId ? 'mainline' : store.activeViewId
  };
}

export function reopenExecutionRoom(store: ExecutionRoomStore, roomId: string): ExecutionRoomStore {
  if (!store.rooms[roomId]) throw new Error('ROOM_NOT_FOUND');
  if (store.activeRoomIds.includes(roomId)) return selectExecutionRoom(store, roomId);
  return {
    ...store,
    activeRoomIds: [...store.activeRoomIds, roomId],
    activeViewId: roomId
  };
}

export function createExecutionRoom(store: ExecutionRoomStore, nextRoom: ExecutionRoomState): ExecutionRoomStore {
  if (store.rooms[nextRoom.roomId]) return reopenExecutionRoom(store, nextRoom.roomId);
  return {
    ...store,
    activeViewId: nextRoom.roomId,
    activeRoomIds: [...store.activeRoomIds, nextRoom.roomId],
    roomOrder: [...store.roomOrder, nextRoom.roomId],
    rooms: { ...store.rooms, [nextRoom.roomId]: nextRoom }
  };
}

export type GptConversationBindingInput = {
  conversationId: string;
  conversationUrl: string;
  title?: string | null;
};

export function chatgptConversationIdentity(value: string): { conversationId: string; conversationUrl: string } {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('CHATGPT_CONVERSATION_URL_INVALID'); }
  if (url.protocol !== 'https:' || url.hostname !== 'chatgpt.com') throw new Error('CHATGPT_CONVERSATION_URL_INVALID');
  const parts = url.pathname.split('/').filter(Boolean);
  const marker = parts.lastIndexOf('c');
  const conversationId = marker >= 0 ? decodeURIComponent(parts[marker + 1] ?? '') : '';
  if (!conversationId || conversationId.includes('/') || /\s/.test(conversationId)) throw new Error('CHATGPT_CONVERSATION_ID_INVALID');
  return { conversationId, conversationUrl: `https://chatgpt.com/c/${encodeURIComponent(conversationId)}` };
}

export function bindGptConversation(
  store: ExecutionRoomStore,
  roomId: string,
  binding: GptConversationBindingInput
): ExecutionRoomStore {
  const identity = chatgptConversationIdentity(binding.conversationUrl);
  if (binding.conversationId !== identity.conversationId) throw new Error('CHATGPT_CONVERSATION_ID_MISMATCH');
  const owner = Object.values(store.rooms).find((roomState) => roomState.roomId !== roomId && roomState.gptConversationBinding === identity.conversationId);
  if (owner) throw new Error('CHATGPT_CONVERSATION_ALREADY_BOUND');
  return updateExecutionRoom(store, roomId, (current) => ({
    ...current,
    gptConversationBinding: identity.conversationId,
    gptConversationUrl: identity.conversationUrl,
    gptConversationTitle: typeof binding.title === 'string' && binding.title.trim() ? binding.title.trim().slice(0, 300) : null
  }));
}

export function unbindGptConversation(store: ExecutionRoomStore, roomId: string): ExecutionRoomStore {
  return updateExecutionRoom(store, roomId, (current) => ({
    ...current,
    gptConversationBinding: null,
    gptConversationUrl: null,
    gptConversationTitle: null
  }));
}

export function updateExecutionRoom(
  store: ExecutionRoomStore,
  roomId: string,
  update: (roomState: ExecutionRoomState) => ExecutionRoomState
): ExecutionRoomStore {
  const current = store.rooms[roomId];
  if (!current) throw new Error('ROOM_NOT_FOUND');
  return {
    ...store,
    rooms: { ...store.rooms, [roomId]: update(current) }
  };
}

export function patchExecutionRoomUi(
  store: ExecutionRoomStore,
  roomId: string,
  patch: Partial<ExecutionRoomUiState>
): ExecutionRoomStore {
  return updateExecutionRoom(store, roomId, (current) => ({
    ...current,
    ui: { ...current.ui, ...patch }
  }));
}

export function toggleRoadmapSection(
  store: ExecutionRoomStore,
  roomId: string,
  section: RoadmapSection
): ExecutionRoomStore {
  return updateExecutionRoom(store, roomId, (current) => ({
    ...current,
    ui: {
      ...current.ui,
      collapsedSections: {
        ...current.ui.collapsedSections,
        [section]: !current.ui.collapsedSections[section]
      }
    }
  }));
}
