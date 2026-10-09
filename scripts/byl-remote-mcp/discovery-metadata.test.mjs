import test from 'node:test';
import assert from 'node:assert/strict';
import {metadata,RESOURCE} from './discovery-metadata.mjs';
test('verified-style issuer and exact canonical resource',()=>{
 const issuer='https://example.cloudflareaccess.com';
 assert.deepEqual(metadata(issuer),{resource:RESOURCE,authorization_servers:[issuer]});
 assert.throws(()=>metadata('http://example.cloudflareaccess.com'));
 assert.throws(()=>metadata('https://invalid.example'));
 assert.throws(()=>metadata(issuer,'https://mcp-uat.beyourlover.com'));
});
