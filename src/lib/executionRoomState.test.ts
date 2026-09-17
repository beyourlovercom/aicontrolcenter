import assert from 'node:assert/strict';
import {
  EXECUTION_ROOM_STORAGE_KEY,
  bindGptConversation,
  chatgptConversationIdentity,
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
assert.equal(defaults.activeRoomIds.length, 4);
assert.equal(new Set(defaults.activeRoomIds).size, 4);
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
const fiveRooms = createExecutionRoom(defaults, fifthRoom);
assert.equal(fiveRooms.activeRoomIds.length, 5);
assert.equal(fiveRooms.activeViewId, 'fifth');

const inquiryReopened = reopenExecutionRoom(inquiryClosed, 'inquiry');
assert.equal(inquiryReopened.activeRoomIds.length, 4);
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
assert.equal(recovered.activeRoomIds.length, 4);
assert.equal(recovered.activeViewId, 'traffic');


const externalBase = defaults;
const familyRoom = createExternalExecutionRoomState({
  roomId: 'family-web-a1b2c3d4', name: 'Family Web', projectId: 'family-plan', workstreamId: 'family-web',
  repositoryIdentity: 'beyourlovercom/family-plan', branch: 'feature/family-web-v1-3', worktree: '/worktrees/family-web-v1-3', head: 'a'.repeat(40)
});
const withFamily = createExecutionRoom(externalBase, familyRoom);
assert.equal(withFamily.activeRoomIds.length, 5);
assert.equal(withFamily.activeViewId, familyRoom.roomId);
assert.equal(withFamily.rooms[familyRoom.roomId].projectId, 'family-plan');
assert.equal(withFamily.rooms[familyRoom.roomId].repo, 'beyourlovercom/family-plan');
assert.equal(withFamily.rooms[familyRoom.roomId].branch, 'feature/family-web-v1-3');
assert.equal(withFamily.rooms[familyRoom.roomId].baseSha, 'a'.repeat(40));
assert.equal(withFamily.rooms[familyRoom.roomId].gptConversationBinding, null);
const normalizedMany = loadExecutionRoomStore({ getItem: () => JSON.stringify(withFamily), setItem: () => {} });
assert.equal(normalizedMany.activeRoomIds.length, 5);
assert.throws(() => createExternalExecutionRoomState({...familyRoom, roomId: ''} as any), /EXTERNAL_ROOM_INPUT_INVALID/);


const boundExternal = bindGptConversation(withFamily, familyRoom.roomId, {
  conversationId: 'family-room-conversation',
  conversationUrl: 'https://chatgpt.com/c/family-room-conversation',
  title: 'Family Room GPT'
});
const refreshedExternal = refreshExternalRoomRuntime(boundExternal, familyRoom.roomId, {projects:[{
  id:'family-plan', repositoryIdentity:'beyourlovercom/family-plan', workstreams:[{id:'family-web',runtimes:[
    {path:'/worktrees/family-web-new',branch:'feature/family-web-v1-4',head:'b'.repeat(40),dirty:false,detached:false,executable:true,committedAt:'2026-09-17T10:00:00Z'},
    {path:'/worktrees/family-web-v1-3',branch:'feature/family-web-v1-3',head:'a'.repeat(40),dirty:false,detached:false,executable:true,committedAt:'2026-09-16T10:00:00Z'}
  ]}]
}]});
assert.equal(refreshedExternal.changed,true);
assert.equal(refreshedExternal.code,'EXTERNAL_RUNTIME_REFRESHED');
assert.equal(refreshedExternal.store.rooms[familyRoom.roomId].branch,'feature/family-web-v1-4');
assert.equal(refreshedExternal.store.rooms[familyRoom.roomId].worktree,'/worktrees/family-web-new');
assert.equal(refreshedExternal.store.rooms[familyRoom.roomId].baseSha,'b'.repeat(40));
assert.equal(refreshedExternal.store.rooms[familyRoom.roomId].gptConversationBinding,'family-room-conversation');
assert.equal(refreshedExternal.store.rooms[familyRoom.roomId].gptConversationUrl,'https://chatgpt.com/c/family-room-conversation');
assert.equal(refreshedExternal.store.rooms[familyRoom.roomId].canonicalRefresh?.fromBranch,'feature/family-web-v1-3');
assert.equal(refreshedExternal.store.rooms[familyRoom.roomId].canonicalRefresh?.toBranch,'feature/family-web-v1-4');
assert.equal(refreshedExternal.store.rooms[familyRoom.roomId].canonicalRefresh?.conversationBindingPreserved,true);
assert.ok(Date.parse(refreshedExternal.store.rooms[familyRoom.roomId].canonicalRefresh?.refreshedAt ?? ''));
const currentExternal = refreshExternalRoomRuntime(refreshedExternal.store, familyRoom.roomId, {projects:[{
  id:'family-plan', repositoryIdentity:'beyourlovercom/family-plan', workstreams:[{id:'family-web',runtimes:[
    {path:'/worktrees/family-web-new',branch:'feature/family-web-v1-4',head:'b'.repeat(40),dirty:false,detached:false,executable:true,committedAt:'2026-09-17T10:00:00Z'}
  ]}]
}]});
assert.equal(currentExternal.changed,false);
assert.equal(currentExternal.code,'EXTERNAL_RUNTIME_CURRENT');

console.log('executionRoomState.test.ts PASS');
