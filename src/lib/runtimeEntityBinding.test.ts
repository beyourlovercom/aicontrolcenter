import assert from 'node:assert/strict';
import {bindExecutionToOriginContext,parseExecutionV1} from './bridgeCore.ts';

const instruction=parseExecutionV1(`AICC_EXECUTION_V1
ENTITY_TYPE: WORK_PACKAGE
ENTITY_ID: AICC-V2-REVIEW-EXACT-HEAD-CI-001
EXECUTION_TYPE: READ_ONLY_AUDIT
REPOSITORY: /Users/a/AI/007/AIcontrolcenter
BRANCH: rebuild/aicc-v2
EXPECTED_HEAD: test-head
SANDBOX: read-only

INSTRUCTION_BEGIN
read branch and HEAD
INSTRUCTION_END`);
const bound=bindExecutionToOriginContext(instruction,{type:'work_package',id:'AICC-V2-REVIEW-CI-001'});
assert.equal(bound.entityType,'WORK_PACKAGE');
assert.equal(bound.entityId,'AICC-V2-REVIEW-CI-001');
assert.equal(bound.workPackageId,'AICC-V2-REVIEW-CI-001');
assert.deepEqual(bound.originContext?.executionContext,{type:'work_package',id:'AICC-V2-REVIEW-CI-001'});
assert.equal(bound.instructionBody,instruction.instructionBody,'raw execution body remains unchanged');
console.log('runtime entity binding matrix passed');
