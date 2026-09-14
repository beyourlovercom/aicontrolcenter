import assert from 'node:assert/strict';
import {
  EXECUTION_ROOM_STORAGE_KEY,
  MAX_ACTIVE_ROOMS,
  bindGptConversation,
  chatgptConversationIdentity,
  closeExecutionRoom,
  createDefaultExecutionRoomStore,
  createExecutionRoom,
  loadExecutionRoomStore,
  patchExecutionRoomUi,
  persistExecutionRoomStore,
  reopenExecutionRoom,
  selectExecutionRoom,
  toggleRoadmapSection,
  unbindGptConversation
} from './executionRoomState.ts';

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const defaults = createDefaultExecutionRoomStore();
assert.equal(defaults.activeRoomIds.length, MAX_ACTIVE_ROOMS);
assert.equal(new Set(defaults.activeRoomIds).size, MAX_ACTIVE_ROOMS);
assert.equal(defaults.activeViewId, 'traffic');

const trafficCollapsed = patchExecutionRoomUi(defaults, 'traffic', { leftPanelCollapsed: true });
assert.equal(trafficCollapsed.rooms.traffic.ui.leftPanelCollapsed, true);
assert.equal(trafficCollapsed.rooms.inquiry.ui.leftPanelCollapsed, false);
assert.equal(defaults.rooms.traffic.ui.leftPanelCollapsed, false);

const trafficTaskCollapsed = toggleRoadmapSection(trafficCollapsed, 'traffic', 'task');
assert.equal(trafficTaskCollapsed.rooms.traffic.ui.collapsedSections.task, true);
assert.equal(trafficTaskCollapsed.rooms.inquiry.ui.collapsedSections.task, false);

const identity = chatgptConversationIdentity('https://chatgpt.com/c/traffic-conversation?model=sol');
assert.equal(identity.conversationId, 'traffic-conversation');
const trafficBound = bindGptConversation(trafficTaskCollapsed, 'traffic', {
  conversationId: 'traffic-conversation',
  conversationUrl: 'https://chatgpt.com/c/traffic-conversation',
  title: 'Traffic GPT'
});
assert.equal(trafficBound.rooms.traffic.gptConversationBinding, 'traffic-conversation');
assert.equal(trafficBound.rooms.traffic.gptConversationTitle, 'Traffic GPT');
assert.equal(trafficBound.rooms.inquiry.gptConversationBinding, null);
assert.throws(() => bindGptConversation(trafficBound, 'inquiry', {
  conversationId: 'traffic-conversation',
  conversationUrl: 'https://chatgpt.com/c/traffic-conversation'
}), /CHATGPT_CONVERSATION_ALREADY_BOUND/);
const trafficUnbound = unbindGptConversation(trafficBound, 'traffic');
assert.equal(trafficUnbound.rooms.traffic.gptConversationBinding, null);

const inquirySelected = selectExecutionRoom(trafficTaskCollapsed, 'inquiry');
assert.equal(inquirySelected.activeViewId, 'inquiry');
assert.equal(inquirySelected.rooms.traffic.ui.collapsedSections.task, true);
assert.equal(inquirySelected.rooms.inquiry.ui.collapsedSections.task, false);

const inquiryClosed = closeExecutionRoom(inquirySelected, 'inquiry');
assert.equal(inquiryClosed.activeRoomIds.includes('inquiry'), false);
assert.equal(inquiryClosed.activeViewId, 'mainline');
assert.equal(inquiryClosed.rooms.inquiry.branch, defaults.rooms.inquiry.branch);
assert.equal(inquiryClosed.rooms.inquiry.worktree, defaults.rooms.inquiry.worktree);

assert.throws(() => reopenExecutionRoom(defaults, 'missing'), /ROOM_NOT_FOUND/);
const fifthRoom = {
  ...defaults.rooms.traffic,
  roomId: 'fifth',
  name: 'Fifth Room',
  workstreamId: 'fifth-room',
  branch: 'feature/fifth-room',
  worktree: '/worktrees/fifth-room'
};
assert.throws(() => createExecutionRoom(defaults, fifthRoom), /ACTIVE_ROOM_LIMIT_REACHED/);

const inquiryReopened = reopenExecutionRoom(inquiryClosed, 'inquiry');
assert.equal(inquiryReopened.activeRoomIds.length, MAX_ACTIVE_ROOMS);
assert.equal(inquiryReopened.activeViewId, 'inquiry');
assert.equal(inquiryReopened.rooms.inquiry.branch, defaults.rooms.inquiry.branch);

const storage = new MemoryStorage();
persistExecutionRoomStore(storage, trafficTaskCollapsed);
assert.ok(storage.getItem(EXECUTION_ROOM_STORAGE_KEY));
const restored = loadExecutionRoomStore(storage);
assert.equal(restored.rooms.traffic.ui.leftPanelCollapsed, true);
assert.equal(restored.rooms.traffic.ui.collapsedSections.task, true);
assert.equal(restored.rooms.inquiry.ui.leftPanelCollapsed, false);

storage.setItem(EXECUTION_ROOM_STORAGE_KEY, '{not-json');
const recovered = loadExecutionRoomStore(storage);
assert.equal(recovered.activeRoomIds.length, MAX_ACTIVE_ROOMS);
assert.equal(recovered.activeViewId, 'traffic');

console.log('executionRoomState.test.ts PASS');
