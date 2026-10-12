import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash, generateKeyPairSync, sign, verify} from 'node:crypto';

// Protocol contract only: isolated, ephemeral keys. This does not contact a live Agent.
function canonical(method, path, timestamp, body) {
  const hash = createHash('sha256').update(body).digest('hex');
  return Buffer.from(`${method}\n${path}\n${timestamp}\n${hash}`);
}
function authenticate({method, path, timestamp, body, signature, publicKey, now}) {
  if (!/^\d+$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 60_000) return false;
  try { return verify(null, canonical(method, path, timestamp, body), publicKey, signature); }
  catch { return false; }
}
const primary = generateKeyPairSync('ed25519');
const unrelated = generateKeyPairSync('ed25519');
const now = 1_800_000_000_000;
const request = {method:'POST',path:'/v1/call',timestamp:String(now),body:Buffer.from('{"name":"get_config"}')};
const signature = sign(null,canonical(request.method,request.path,request.timestamp,request.body),primary.privateKey);
const valid = (overrides={}) => authenticate({...request,signature,publicKey:primary.publicKey,now,...overrides});
test('valid ephemeral Ed25519 signature is accepted',()=>assert.equal(valid(),true));
test('unsigned request rejected',()=>assert.equal(valid({signature:Buffer.alloc(64)}),false));
test('unrelated key rejected',()=>assert.equal(valid({publicKey:unrelated.publicKey}),false));
test('body tampering rejected',()=>assert.equal(valid({body:Buffer.from('{}')}),false));
test('route tampering rejected',()=>assert.equal(valid({path:'/v1/tools'}),false));
test('expired timestamp rejected',()=>assert.equal(valid({now:now+60_001}),false));
test('invalid timestamp rejected',()=>assert.equal(valid({timestamp:'bad'}),false));
