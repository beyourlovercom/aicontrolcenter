import test from 'node:test';
import assert from 'node:assert/strict';
import {listDevices,resolveDevice} from './device-router.mjs';

test('registry exposes three ready canonical devices',()=>{
  assert.deepEqual(listDevices(),[
    {id:'us-macmini',state:'READY'},
    {id:'china-mac',state:'READY'},
    {id:'windows',state:'READY'}
  ]);
});
test('all ready devices resolve to fixed tailscale upstreams',()=>{
  assert.equal(resolveDevice('us-macmini').device.upstream,'http://100.94.52.109:8787');
  assert.equal(resolveDevice('china-mac').device.upstream,'http://100.102.15.40:8791');
  assert.equal(resolveDevice('windows').device.upstream,'http://100.87.29.56:8791');
});
test('missing and unknown devices fail closed',()=>{
  assert.equal(resolveDevice('').errorCode,'GATEWAY_DEVICE_REQUIRED');
  assert.equal(resolveDevice('nope').errorCode,'GATEWAY_DEVICE_UNKNOWN');
});
