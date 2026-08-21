import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';

const adapter=readFileSync(join(process.cwd(),'web-adapter/chatgpt-dom.js'),'utf8');
const content=readFileSync(join(process.cwd(),'web-adapter/chrome-extension-current/content.js'),'utf8');
const context:{AICCChatGPTDom?:Record<string,any>;setTimeout:typeof setTimeout;Event:typeof Event;TextEncoder:typeof TextEncoder;crypto:Crypto}={setTimeout,Event,TextEncoder,crypto:globalThis.crypto};
vm.runInNewContext(adapter,context);
const probe=context.AICCChatGPTDom!;
const conversationId='6a813da4-90f4-83ec-aba5-ebd476b7f3fe';
const bindingEpoch=20;
const now='2026-08-16T06:00:00.000Z';
const legacyFailure={state:'FAILED',reason:'INSERT_VERIFICATION_FAILED',identity:null,submit_trigger_count:0,updated_at:'2026-08-16T05:00:00.000Z'};

const isolated=probe.isolateAutoSubmitProbeState({activeSubmissionId:'aicc-auto-submit-probe-003',historicalSubmissionId:'aicc-auto-submit-probe-002',legacyRecord:legacyFailure,activeRecord:null,historicalRecord:null,conversationId,bindingEpoch,now});
assert.equal(isolated.historical.submission_id,'aicc-auto-submit-probe-002');
assert.equal(isolated.historical.state,'FAILED');
assert.equal(isolated.historical.failure_reason,'INSERT_VERIFICATION_FAILED');
assert.equal(isolated.active.submission_id,'aicc-auto-submit-probe-003');
assert.equal(isolated.active.state,'READY');
assert.equal(isolated.active.failure_reason,'');
assert.equal(isolated.active.conversation_id,conversationId);
assert.equal(isolated.active.binding_epoch,bindingEpoch);
assert.notEqual(probe.autoSubmitProbeStorageKey(isolated.active.submission_id),probe.autoSubmitProbeStorageKey(isolated.historical.submission_id));

const reloaded=probe.isolateAutoSubmitProbeState({activeSubmissionId:'aicc-auto-submit-probe-003',historicalSubmissionId:'aicc-auto-submit-probe-002',legacyRecord:legacyFailure,activeRecord:isolated.active,historicalRecord:isolated.historical,conversationId,bindingEpoch,now:'2026-08-16T06:01:00.000Z'});
assert.deepEqual(reloaded.active,isolated.active,'reload restores the exact active READY record');
assert.deepEqual(reloaded.historical,isolated.historical,'reload preserves historical failed evidence');

const activeConfirmed=probe.normalizeAutoSubmitProbeRecord({...isolated.active,state:'CONFIRMED',identity:{submission_id:'aicc-auto-submit-probe-003',user_message_id:'user-003'},submit_trigger_count:1,updated_at:'2026-08-16T06:02:00.000Z'},{submissionId:'aicc-auto-submit-probe-003'});
const terminalReload=probe.isolateAutoSubmitProbeState({activeSubmissionId:'aicc-auto-submit-probe-003',historicalSubmissionId:'aicc-auto-submit-probe-002',legacyRecord:legacyFailure,activeRecord:activeConfirmed,historicalRecord:isolated.historical,conversationId,bindingEpoch,now:'2026-08-16T06:03:00.000Z'});
assert.equal(terminalReload.active.state,'CONFIRMED');
assert.equal(terminalReload.active.submit_trigger_count,1);
assert.equal(terminalReload.active.confirmed_user_message_id,'user-003');
assert.equal(terminalReload.historical.state,'FAILED');

const nextProbe=probe.isolateAutoSubmitProbeState({activeSubmissionId:'aicc-auto-submit-probe-004',historicalSubmissionId:'aicc-auto-submit-probe-003',activeRecord:null,historicalRecord:terminalReload.active,conversationId,bindingEpoch,now:'2026-08-16T06:04:00.000Z'});
assert.equal(nextProbe.active.submission_id,'aicc-auto-submit-probe-004');
assert.equal(nextProbe.active.state,'READY');
assert.equal(nextProbe.historical.submission_id,'aicc-auto-submit-probe-003');
assert.equal(nextProbe.historical.state,'CONFIRMED');

for(const field of ['submission_id','conversation_id','binding_epoch','state','failure_reason','created_at','updated_at','confirmed_user_message_id'])assert.ok(field in isolated.active,`active record has ${field}`);
assert.match(content,/AUTO_SUBMIT_PROBE_KEY = window\.AICCChatGPTDom\.autoSubmitProbeStorageKey\(AUTO_SUBMIT_PROBE_ID\)/);
assert.match(content,/HISTORICAL_AUTO_SUBMIT_PROBE_KEY = window\.AICCChatGPTDom\.autoSubmitProbeStorageKey\(HISTORICAL_AUTO_SUBMIT_PROBE_ID\)/);
assert.match(content,/previousIsolation\.historical/,'probe-002 evidence remains in its own durable key');
assert.match(content,/activeIsolation\.historical/,'probe-003 evidence remains independent from active probe-004');
assert.match(content,/status\.dataset\.aiccProbeSubmissionId = activeIsolation\.active\.submission_id/,'visible status is bound to the active identity');
assert.match(content,/binding_epoch !== autoLoop\.loop\.binding_epoch/,'binding epoch remains a readiness invariant');
assert.match(content,/\['FAILED', 'CONFIRMED'\]\.includes\(autoSubmitProbeLifecycle\.state\)/,'terminal active identities cannot be resurrected');
const restore=content.match(/function restoreAutoSubmitProbeState\(\)[\s\S]*?(?=\n  function probeFailure)/)?.[0]??'';
assert.doesNotMatch(restore,/\.clear\(|\.remove\(/,'probe migration performs no destructive storage reset');
console.log('M8.2.1.8.4D auto-submit probe state isolation matrix passed');
