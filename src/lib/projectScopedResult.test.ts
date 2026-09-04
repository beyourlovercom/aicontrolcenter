import assert from 'node:assert/strict';
import {buildGptReturnEnvelope} from './gptReturn.ts';
import {scopedEntityKey} from './projectEntityScope.ts';

const aicc={projectId:'aicc',repositoryIdentity:'beyourlovercom/aicontrolcenter'};
const erp={projectId:'erpbeyourlovercom',repositoryIdentity:'beyourlovercom/erpbeyourlovercom'};
const sameRun='run-1';
assert.notEqual(scopedEntityKey(aicc,'RUN',sameRun),scopedEntityKey(erp,'RUN',sameRun),'a result must be addressed by project plus exact run');
assert.equal(buildGptReturnEnvelope({version:'AICC_EXECUTION_RESULT_V1',executionId:sameRun,projectId:aicc.projectId,repositoryIdentity:aicc.repositoryIdentity,rawResult:'exact Codex payload',receivedAt:'2026-08-20T00:00:00.000Z',resultId:'result-1',resultHash:'hash'}),'exact Codex payload');
console.log('Phase 3 project-scoped result identity matrix passed');
