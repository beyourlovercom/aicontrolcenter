import assert from 'node:assert/strict';
import {getStatusPresentationMeta,resolvePresentationStatus,statusPresentationRegistry} from './statusPresentation.ts';

for(const meta of Object.values(statusPresentationRegistry)){
  assert.ok(meta.colorToken&&meta.ownerLabel&&meta.shortDescription&&meta.tooltipDescription);
  assert.equal(/#[0-9a-f]{3,8}|rgb\(|hsl\(/i.test(JSON.stringify(meta)),false);
}
assert.equal(resolvePresentationStatus('PLANNED'),'NOT_STARTED');
assert.equal(resolvePresentationStatus('IMPLEMENTATION'),'IN_PROGRESS');
assert.equal(resolvePresentationStatus('READY_FOR_OWNER_AUTHORIZATION'),'WAITING_OWNER');
assert.equal(resolvePresentationStatus('HUMAN_UAT'),'WAITING_UAT');
assert.notEqual(resolvePresentationStatus('WAITING_OWNER'),resolvePresentationStatus('WAITING_UAT'));
assert.notEqual(resolvePresentationStatus('PASS'),resolvePresentationStatus('COMPLETE'));
assert.notEqual(resolvePresentationStatus('ABSENT'),resolvePresentationStatus('UNAVAILABLE'));
assert.notEqual(resolvePresentationStatus('UNAVAILABLE'),resolvePresentationStatus('FAILED'));
assert.equal(resolvePresentationStatus('future-unmapped-status'),'UNKNOWN');
assert.equal(getStatusPresentationMeta('future-unmapped-status').ownerLabel,'未知状态');
