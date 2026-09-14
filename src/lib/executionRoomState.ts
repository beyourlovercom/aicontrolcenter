export const EXECUTION_ROOM_STORAGE_KEY = 'aicc.v5.execution-rooms.v1';
export const MAX_ACTIVE_ROOMS = 4;
export const V5_1_BASE_SHA = '301d176cf7a10e2a9fe8f83490d9a28196a0ddde';

export type RoadmapSection = 'blueprint' | 'wp' | 'pr' | 'task' | 'gate';
export type ExecutionViewId = 'mainline' | string;
export type ExecutionRoomStatus = 'READY' | 'RUNNING' | 'WAITING' | 'UAT' | 'BLOCKED';

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
  codexSession: string | null;
  runtime: string | null;
  currentWp: string;
  currentPr: string | null;
  currentTask: string;
  currentGate: string;
  status: ExecutionRoomStatus;
  nextGate: string;
  ownerUatRequired: boolean;
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
    codexSession: null,
    runtime: null,
    currentWp: 'V5.1 — Room State / Isolation',
    currentPr: null,
    currentTask: 'ROOM_STATE_ISOLATION',
    currentGate: 'ROOM_ISOLATION_UAT',
    status: 'READY',
    nextGate: 'V5.2 — Chrome GPT Binding',
    ownerUatRequired: true,
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
    .filter((id) => Boolean(candidate.rooms[id]))
    .slice(0, MAX_ACTIVE_ROOMS);
  const activeViewId = candidate.activeViewId === 'mainline' || activeRoomIds.includes(candidate.activeViewId)
    ? candidate.activeViewId
    : 'mainline';

  return {
    version: 1,
    activeViewId,
    activeRoomIds,
    roomOrder,
    rooms: { ...candidate.rooms }
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
  if (store.activeRoomIds.length >= MAX_ACTIVE_ROOMS) throw new Error('ACTIVE_ROOM_LIMIT_REACHED');
  return {
    ...store,
    activeRoomIds: [...store.activeRoomIds, roomId],
    activeViewId: roomId
  };
}

export function createExecutionRoom(store: ExecutionRoomStore, nextRoom: ExecutionRoomState): ExecutionRoomStore {
  if (store.activeRoomIds.length >= MAX_ACTIVE_ROOMS) throw new Error('ACTIVE_ROOM_LIMIT_REACHED');
  if (store.rooms[nextRoom.roomId]) return reopenExecutionRoom(store, nextRoom.roomId);
  return {
    ...store,
    activeViewId: nextRoom.roomId,
    activeRoomIds: [...store.activeRoomIds, nextRoom.roomId],
    roomOrder: [...store.roomOrder, nextRoom.roomId],
    rooms: { ...store.rooms, [nextRoom.roomId]: nextRoom }
  };
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
