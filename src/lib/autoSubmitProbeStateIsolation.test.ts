import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const dom=readFileSync(join(process.cwd(),'web-adapter/chatgpt-dom.js'),'utf8');
const content=readFileSync(join(process.cwd(),'web-adapter/chrome-extension-current/content.js'),'utf8');
const worker=readFileSync(join(process.cwd(),'web-adapter/chrome-extension-current/service-worker.js'),'utf8');
const loop=readFileSync(join(process.cwd(),'src/lib/gptAutoControlLoop.ts'),'utf8');

assert.doesNotMatch(dom,/isolateAutoSubmitProbeState|autoSubmitProbeStorageKey|normalizeAutoSubmitProbeRecord/,'legacy Probe state authority stays removed from the DOM adapter');
assert.doesNotMatch(content,/AUTO_SUBMIT_PROBE_KEY|HISTORICAL_AUTO_SUBMIT_PROBE_KEY|restoreAutoSubmitProbeState|autoSubmitProbeLifecycle/,'legacy Probe storage cannot return');
assert.match(content,/AUTO_LOOP_FEEDBACK_STATE.*operation: 'inserting'/,'current feedback insertion lifecycle is explicit');
assert.match(content,/AUTO_LOOP_FEEDBACK_STATE.*operation: 'submitting'/,'current durable Send claim is explicit');
assert.match(worker,/AUTO_LOOP_FEEDBACK_STATE.*autoLoopFeedbackState/,'feedback state transitions are persisted through the canonical worker route');
assert.match(loop,/function feedbackState\(control_loop_id: string, feedback_key: string, scope\?: ProjectIdentityScope\)/,'feedback mutation resolver accepts exact project scope');
assert.match(loop,/AMBIGUOUS_FEEDBACK_IDENTITY/,'unscoped colliding feedback identities fail closed');
assert.match(loop,/markFeedbackInserting\(control_loop_id: string, feedback_key: string, scope\?: ProjectIdentityScope\)/,'insertion mutation preserves project-scope isolation');
assert.match(loop,/markFeedbackSubmitted\(control_loop_id: string, feedback_key: string,.*scope\?: ProjectIdentityScope\)/s,'submission lifecycle preserves project-scope isolation');
console.log('M8.2.1.8.4D legacy Probe removal + canonical feedback isolation guard passed');
