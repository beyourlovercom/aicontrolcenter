import test from 'node:test';
import assert from 'node:assert/strict';
import {listDevices,resolveDevice} from './device-router.mjs';

test('registry exposes four ready canonical devices with kinds',()=>{
  assert.deepEqual(listDevices(),[
    {id:'us-macmini',state:'READY',kind:'aicc-runner'},
    {id:'china-mac',state:'READY',kind:'dc-agent'},
    {id:'windows',state:'READY',kind:'dc-agent'},
    {id:'007windows',state:'READY',kind:'dc-agent'}
  ]);
});
test('device routing is static and typed',()=>{
  assert.equal(resolveDevice('us-macmini').device.kind,'aicc-runner');
  assert.equal(resolveDevice('china-mac').device.upstream,'http://100.102.15.40:8791');
  assert.equal(resolveDevice('windows').device.upstream,'http://100.87.29.56:8791');
  assert.equal(resolveDevice('007windows').device.upstream,'http://100.99.21.57:8791');
});
test('missing and unknown devices fail closed',()=>{
  assert.equal(resolveDevice('').errorCode,'GATEWAY_DEVICE_REQUIRED');
  assert.equal(resolveDevice('nope').errorCode,'GATEWAY_DEVICE_UNKNOWN');
});
