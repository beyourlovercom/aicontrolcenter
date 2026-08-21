import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {resolveAiccStateDir} from './stateDirectory.ts';
import {persistNewInboxItemForTest,saveInboxItemForTest,canonicalTaskFromInbox,queryProjectScopedTaskRegistry,parseExecutionV1,createNaturalLanguageInstruction,type CanonicalTaskRecord,type ExecutionInstruction,type InboxItem} from './bridgeCore.ts';

const dir=resolveAiccStateDir();
const inboxFile=join(dir,'bridge-inbox.json');

const scopeA={projectId:'aicc',repositoryIdentity:'beyourlovercom/aicontrolcenter',repositoryPath:'/repo/aicc'};
const scopeB={projectId:'erpbeyourlovercom',repositoryIdentity:'beyourlovercom/erpbeyourlovercom',repositoryPath:'/repo/erp'};

const instruction=(scope:typeof scopeA|typeof scopeB,instructionId:string):ExecutionInstruction=>({
  version:'AICC_EXECUTION_V1',instructionId,entityType:'GLOBAL_TASK',entityId:'GLOBAL_TASK',workPackageId:null,
  executionType:'READ_ONLY_AUDIT',repository:scope.repositoryIdentity,branch:'main',expectedHead:'head',
  sandbox:'read-only',requiresAuthorization:false,instructionBody:'fixture',sourceType:'CLIPBOARD',
  ownerDirectExecution:false,receivedAt:'2026-08-21T00:00:00.000Z',entityScope:'GLOBAL_TASK',...scope
} as ExecutionInstruction);

const inboxItem=(scope:typeof scopeA|typeof scopeB,id:string,taskId:string):InboxItem=>({
  id,taskId,state:'READY',transportState:'QUEUED',gates:[],createdAt:'2026-08-21T00:00:00.000Z',
  updatedAt:'2026-08-21T00:00:00.000Z',instruction:instruction(scope,`instruction-${id}`),rawInstruction:'fixture',
  ...scope
} as InboxItem);

// Same InboxItem id and same taskId, distinct project scope — must not collide in persistence.
const SAME_ID='same-inbox-id';
const SAME_TASK_ID='same-task-id';
const itemA=inboxItem(scopeA,SAME_ID,SAME_TASK_ID);
const itemB=inboxItem(scopeB,SAME_ID,SAME_TASK_ID);
persistNewInboxItemForTest(itemA);
persistNewInboxItemForTest(itemB);
const persistedInbox=JSON.parse(readFileSync(inboxFile,'utf8')) as InboxItem[];
assert.equal(persistedInbox.filter(x=>x.id===SAME_ID).length,2);
assert.equal(persistedInbox.find(x=>x.id===SAME_ID&&x.projectId===scopeA.projectId)?.repositoryIdentity,scopeA.repositoryIdentity);
assert.equal(persistedInbox.find(x=>x.id===SAME_ID&&x.projectId===scopeB.projectId)?.repositoryIdentity,scopeB.repositoryIdentity);

const taskA=canonicalTaskFromInbox(itemA);
const taskB=canonicalTaskFromInbox(itemB);
assert.equal((taskA as any).projectId,scopeA.projectId);
assert.equal((taskB as any).projectId,scopeB.projectId);
const builtTasks:CanonicalTaskRecord[]=[taskA,taskB];
assert.equal(builtTasks.filter(record=>record.taskId===SAME_TASK_ID).length,2);
const scopedA=queryProjectScopedTaskRegistry(builtTasks,scopeA);
const scopedB=queryProjectScopedTaskRegistry(builtTasks,scopeB);
assert.equal(scopedA.items.length,1);
assert.equal(scopedB.items.length,1);
assert.equal(scopedA.items[0].repository,scopeA.repositoryIdentity);
assert.equal(scopedB.items[0].repository,scopeB.repositoryIdentity);

// New unscoped canonical InboxItem must be rejected, not silently saved.
assert.throws(()=>persistNewInboxItemForTest({id:'unscoped-item',taskId:'unscoped-task',state:'READY',gates:[],createdAt:'2026-08-21T00:00:00.000Z',updatedAt:'2026-08-21T00:00:00.000Z'} as unknown as InboxItem),/INBOX_PROJECT_SCOPE_REQUIRED/);

// A foreign-project instruction must not be attachable to an InboxItem scoped to another project.
const foreignItem:InboxItem={...inboxItem(scopeA,'foreign-inbox-item','foreign-task'),instruction:instruction(scopeB,'foreign-instruction')};
assert.throws(()=>persistNewInboxItemForTest(foreignItem),/FOREIGN_PROJECT_INSTRUCTION_BINDING/);

// FINDING 3 REGRESSION: same raw inbox id across two projects — update A must not touch B.
const UPDATE_ID='update-collision-id';
const updateA=inboxItem(scopeA,UPDATE_ID,'update-task-a');
const updateB=inboxItem(scopeB,UPDATE_ID,'update-task-b');
persistNewInboxItemForTest(updateA);
persistNewInboxItemForTest(updateB);
const updatedA={...updateA,updatedAt:'2026-08-21T12:00:00.000Z',state:'CONSUMED' as const};
saveInboxItemForTest(updatedA);
const afterUpdate=JSON.parse(readFileSync(inboxFile,'utf8')) as InboxItem[];
const afterA=afterUpdate.find(x=>x.id===UPDATE_ID&&(x as any).projectId===scopeA.projectId);
const afterB=afterUpdate.find(x=>x.id===UPDATE_ID&&(x as any).projectId===scopeB.projectId);
assert.equal(afterA?.state,'CONSUMED','A must reflect the update');
assert.equal(afterA?.updatedAt,'2026-08-21T12:00:00.000Z','A updatedAt must match');
assert.equal(afterB?.state,'READY','B must remain untouched by A update');
assert.equal(afterB?.updatedAt,updateB.updatedAt,'B updatedAt must be unchanged');
const aCount=afterUpdate.filter(x=>x.id===UPDATE_ID&&(x as any).projectId===scopeA.projectId).length;
assert.equal(aCount,1,'A must be updated exactly once — no duplicate rows');

// R2: parser/draft output must never fabricate canonical project scope.
const draftFromV1=parseExecutionV1('AICC_EXECUTION_V1\nENTITY_TYPE: WORK_PACKAGE\nENTITY_ID: WP-DRAFT\nEXECUTION_TYPE: READ_ONLY_AUDIT\nREPOSITORY: r\nBRANCH: b\nEXPECTED_HEAD: h\nSANDBOX: read-only\n\nINSTRUCTION_BEGIN\nfixture\nINSTRUCTION_END');
assert.equal((draftFromV1 as any).projectId,undefined,'AICC_EXECUTION_V1 draft parsing must not fabricate projectId');
assert.equal((draftFromV1 as any).repositoryIdentity,undefined,'AICC_EXECUTION_V1 draft parsing must not fabricate repositoryIdentity');
const draftFromNatural=createNaturalLanguageInstruction('inspect current state');
assert.equal((draftFromNatural as any).projectId,undefined,'natural-language draft must not fabricate projectId');
assert.equal((draftFromNatural as any).repositoryIdentity,undefined,'natural-language draft must not fabricate repositoryIdentity');

// R2/R7: persistNewInboxItem must dedupe by scoped key — same project+repository+raw id must not duplicate.
const DEDUPE_ID='dedupe-inbox-id';
const dedupeFirst=inboxItem(scopeA,DEDUPE_ID,'dedupe-task');
persistNewInboxItemForTest(dedupeFirst);
const dedupeSecond={...inboxItem(scopeA,DEDUPE_ID,'dedupe-task'),updatedAt:'2026-08-21T13:00:00.000Z'};
persistNewInboxItemForTest(dedupeSecond);
const afterDedupe=JSON.parse(readFileSync(inboxFile,'utf8')) as InboxItem[];
assert.equal(afterDedupe.filter(x=>x.id===DEDUPE_ID&&(x as any).projectId===scopeA.projectId).length,1,'same scoped raw id must not duplicate');
assert.equal(afterDedupe.find(x=>x.id===DEDUPE_ID)?.updatedAt,'2026-08-21T13:00:00.000Z','dedupe keeps the latest write');

// R2: same raw id across two projects (after dedupe fix) must remain two independent rows.
const CROSS_ID='cross-project-dedupe-id';
persistNewInboxItemForTest(inboxItem(scopeA,CROSS_ID,'cross-task-a'));
persistNewInboxItemForTest(inboxItem(scopeB,CROSS_ID,'cross-task-b'));
const afterCross=JSON.parse(readFileSync(inboxFile,'utf8')) as InboxItem[];
assert.equal(afterCross.filter(x=>x.id===CROSS_ID).length,2,'same raw id across two projects remains two rows');

// R6: canonicalTaskFromInbox must fail closed when the existing CanonicalTaskRecord belongs to a foreign project scope.
const foreignExistingItem=inboxItem(scopeA,'foreign-existing-item','foreign-existing-task');
const foreignExisting=canonicalTaskFromInbox(inboxItem(scopeB,'foreign-existing-item','foreign-existing-task'));
assert.throws(()=>canonicalTaskFromInbox(foreignExistingItem,undefined,foreignExisting),/FOREIGN_TASK_SCOPE_BINDING/);

// R2/R3: canonicalTaskFromInbox must reject an InboxItem whose item scope and instruction scope are foreign/mismatched.
const mismatchItem=inboxItem(scopeA,'scope-mismatch-item','scope-mismatch-task');
const itemWithForeignInstruction={...mismatchItem,instruction:instruction(scopeB,'mismatched-instruction')};
assert.throws(()=>canonicalTaskFromInbox(itemWithForeignInstruction),/TASK_PROJECT_SCOPE_REQUIRED/,'InboxItem with mismatched instruction scope must be rejected');

console.log('Batch3A task carrier scope isolation passed');
