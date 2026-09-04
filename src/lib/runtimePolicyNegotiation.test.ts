import assert from 'node:assert/strict';
import {resolveRuntimeExecutionPolicy} from './runtimeManager.ts';

assert.deepEqual(resolveRuntimeExecutionPolicy('READ_ONLY_AUDIT','read-only'),{executionType:'READ_ONLY_AUDIT',sandboxMode:'read-only'});
assert.deepEqual(resolveRuntimeExecutionPolicy('implementation','workspace_write'),{executionType:'IMPLEMENTATION',sandboxMode:'workspace-write'});
assert.deepEqual(resolveRuntimeExecutionPolicy('IMPLEMENTATION','workspace-write'),{executionType:'IMPLEMENTATION',sandboxMode:'workspace-write'});
assert.throws(()=>resolveRuntimeExecutionPolicy('READ_ONLY_AUDIT','workspace-write'),/SANDBOX_POLICY_MISMATCH/);
assert.throws(()=>resolveRuntimeExecutionPolicy('IMPLEMENTATION','read-only'),/SANDBOX_POLICY_MISMATCH/);
console.log('runtime policy negotiation matrix passed');
