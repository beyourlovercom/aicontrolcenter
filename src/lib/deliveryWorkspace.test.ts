import assert from 'node:assert/strict';
import {bindExecutionToDeliveryContext,deterministicDeliveryBranch,provisionDeliveryContext} from './deliveryWorkspace.ts';
const input={workPackageId:'AICC-V2-REVIEW-EXACT-HEAD-CI-001',repository:'/repo',baseBranch:'rebuild/aicc-v2',baseSha:'abcdef0123456789',worktreePath:'/tmp/aicc/review'};
assert.equal(deterministicDeliveryBranch(input.workPackageId),'delivery/aicc-v2-review-exact-head-ci-001');
const first=provisionDeliveryContext(input);const second=provisionDeliveryContext(input,[first]);
assert.equal(second.deliveryContextId,first.deliveryContextId);assert.equal(second.worktreePath,first.worktreePath);
const other=provisionDeliveryContext({...input,workPackageId:'AICC-V2-OTHER-001'});assert.notEqual(other.deliveryContextId,first.deliveryContextId);assert.notEqual(other.deliveryBranch,first.deliveryBranch);
assert.equal(bindExecutionToDeliveryContext(first).deliveryContextId,first.deliveryContextId);
console.log('delivery workspace provisioning matrix passed');
