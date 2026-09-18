import test from 'node:test';
import assert from 'node:assert/strict';
import {listDevices,resolveDevice} from './device-router.mjs';

test('registry exposes three canonical devices',()=>{
  assert.deepEqual(listDevices(),[
    {id:'us-macmini',state:'READY'},
    {id:'china-mac',state:'PENDING_AGENT'},
    {id:'windows',state:'PENDING_AGENT'}
  ]);
});
test('us-macmini resolves to fixed tailscale upstream',()=>{
  const r=resolveDevice('us-macmini');
  assert.equal(r.ok,true);
  assert.equal(r.device.upstream,'http://100.94.52.109:8787');
});
test('missing and unknown devices fail closed',()=>{
  assert.equal(resolveDevice('').errorCode,'GATEWAY_DEVICE_REQUIRED');
  assert.equal(resolveDevice('nope').errorCode,'GATEWAY_DEVICE_UNKNOWN');
});
test('registered device without agent is not executable',()=>{
  const r=resolveDevice('windows');
  assert.equal(r.status,409);
  assert.equal(r.errorCode,'GATEWAY_DEVICE_NOT_READY');
});
