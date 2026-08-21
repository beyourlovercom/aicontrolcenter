import assert from 'node:assert/strict';
import {projectTaskLifecycleFromExecutionEvidence} from './bridgeCore.ts';

assert.equal(projectTaskLifecycleFromExecutionEvidence({phase:'FAILED',canonicalResult:{codexResult:'PASS'}}),'COMPLETED','Codex PASS overrides missing or failed process evidence');
assert.equal(projectTaskLifecycleFromExecutionEvidence({phase:'COMPLETED',canonicalResult:{codexResult:'FAIL'}}),'FAILED','Codex FAIL remains the sole Task failure source');
assert.equal(projectTaskLifecycleFromExecutionEvidence({phase:'FAILED'}),'UNKNOWN','process failure without a Codex semantic result cannot create Task FAILED');
assert.equal(projectTaskLifecycleFromExecutionEvidence({phase:'STOPPED'}),'UNKNOWN','Owner stop keeps technical evidence without fabricating semantic result');
assert.equal(projectTaskLifecycleFromExecutionEvidence({phase:'FAILED',canonicalResult:{}}),'UNKNOWN','nonzero process exit without Codex semantic result remains unknown');
console.log('runtime zero semantic failure authority tests passed');
