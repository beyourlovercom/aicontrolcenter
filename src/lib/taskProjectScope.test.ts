import assert from 'node:assert/strict';
import {canonicalTaskFromInbox,queryProjectScopedTaskRegistry} from './bridgeCore.ts';

const aicc={projectId:'aicc',repositoryIdentity:'beyourlovercom/aicontrolcenter'};
const erp={projectId:'erpbeyourlovercom',repositoryIdentity:'beyourlovercom/erpbeyourlovercom'};
const record=(scope:typeof aicc|typeof erp)=>({registryVersion:2,recordType:'CANONICAL_TASK',taskId:'SAME_TASK',inboxId:`inbox-${scope.projectId}`,instructionId:`instruction-${scope.projectId}`,entityScope:'GLOBAL_TASK',workPackageId:null,prId:null,repository:scope.repositoryIdentity,branch:'main',origin:'CLIPBOARD',status:'READY',createdAt:'2026-08-20T00:00:00.000Z',updatedAt:'2026-08-20T00:00:00.000Z',instruction:{version:'AICC_EXECUTION_V1',instructionId:`instruction-${scope.projectId}`,entityType:'GLOBAL_TASK',entityId:'GLOBAL_TASK',workPackageId:null,executionType:'READ_ONLY_AUDIT',repository:scope.repositoryIdentity,branch:'main',expectedHead:'head',sandbox:'read-only',requiresAuthorization:false,instructionBody:'fixture',sourceType:'CLIPBOARD',ownerDirectExecution:false,receivedAt:'2026-08-20T00:00:00.000Z',entityScope:'GLOBAL_TASK',...scope},rawInstruction:'fixture',...scope} as any);
const records=[record(aicc),record(erp)];
assert.equal(queryProjectScopedTaskRegistry(records,aicc).items.length,1);assert.equal(queryProjectScopedTaskRegistry(records,aicc).items[0].repository,'beyourlovercom/aicontrolcenter');
assert.equal(queryProjectScopedTaskRegistry(records,erp).items.length,1);assert.equal(queryProjectScopedTaskRegistry(records,erp).items[0].repository,'beyourlovercom/erpbeyourlovercom');
const inbox={id:'inbox-create',taskId:'SAME_TASK',state:'READY',createdAt:'2026-08-20T00:00:00.000Z',updatedAt:'2026-08-20T00:00:00.000Z',gates:[],instruction:record(aicc).instruction} as any;
const created=canonicalTaskFromInbox(inbox);
assert.equal((created as any).projectId,aicc.projectId);assert.equal((created as any).repositoryIdentity,aicc.repositoryIdentity);
const immutable=canonicalTaskFromInbox({...inbox,instruction:record(erp).instruction},undefined,created);
assert.equal((immutable as any).projectId,aicc.projectId);assert.equal((immutable as any).repositoryIdentity,aicc.repositoryIdentity);
console.log('Phase 3 Step A project-scoped Task registry matrix passed');
