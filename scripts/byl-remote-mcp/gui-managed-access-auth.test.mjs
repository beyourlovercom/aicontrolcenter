import test from 'node:test';
import assert from 'node:assert/strict';
import {makePrimaryAuthorizer,validateAccessConfig,setupPrimaryAuthorizer} from './gui-managed-access-auth.mjs';
const cloudflare=validateAccessConfig({team:'example-team',audience:'f'.repeat(64),ownerEmails:'owner@example.com,backup@example.com'});
const legacyToken='0123456789abcdef'.repeat(4);
const fakeReq=headers=>({headers});
test('Cloudflare issuer audience and owner allowlist are fixed',()=>{
 assert.equal(cloudflare.issuer,'https://example-team.cloudflareaccess.com');
 assert.equal(cloudflare.ownerEmails.size,2);
});
test('invalid config rejected',()=>{
 for(const input of [
 {team:'evil.com',audience:'f'.repeat(64),ownerEmails:'owner@example.com'},
 {team:'example-team',audience:'short',ownerEmails:'owner@example.com'},
 {team:'example-team',audience:'f'.repeat(64),ownerEmails:'*'},
 {team:'example-team',audience:'f'.repeat(64),ownerEmails:'owner@example.com,owner@example.com'}
 ])assert.throws(()=>validateAccessConfig(input));
});
test('legacy bearer preserved',async()=>{
 const auth=makePrimaryAuthorizer({legacyToken,cloudflare,verifyAccessJwt:async()=>{throw Error('must not verify')}});
 assert.equal((await auth(fakeReq({authorization:'Bearer '+legacyToken}))).method,'legacy');
 assert.equal((await auth(fakeReq({authorization:'Bearer '+legacyToken+'z'}))).ok,false);
 assert.equal((await auth(fakeReq({authorization:'Basic '+legacyToken}))).ok,false);
});
test('valid asserted owner accepted',async()=>{
 const auth=makePrimaryAuthorizer({legacyToken,cloudflare,verifyAccessJwt:async(t,c)=>{assert.equal(c.audience,'f'.repeat(64));return {email:'Owner@Example.com'}}});
 assert.equal((await auth(fakeReq({'cf-access-jwt-assertion':'z'.repeat(100)}))).method,'cloudflare-access');
});
test('non owner, malformed and forged token rejected',async()=>{
 const denied=makePrimaryAuthorizer({legacyToken,cloudflare,verifyAccessJwt:async()=>({email:'attacker@example.com'})});
 assert.equal((await denied(fakeReq({'cf-access-jwt-assertion':'z'.repeat(100)}))).reason,'OWNER_DENIED');
 const invalid=makePrimaryAuthorizer({legacyToken,cloudflare,verifyAccessJwt:async()=>{throw Error('invalid signature')}});
 assert.equal((await invalid(fakeReq({'cf-access-jwt-assertion':'z'.repeat(100)}))).reason,'JWT_INVALID');
 assert.equal((await invalid(fakeReq({'cf-access-jwt-assertion':'short'}))).ok,false);
});
test('configuration fails closed on partial OAuth config',()=>{
 assert.throws(()=>setupPrimaryAuthorizer({CF_ACCESS_TEAM:'example-team'},legacyToken),/CF_AUTH_INCOMPLETE/);
 const legacyOnly=setupPrimaryAuthorizer({},legacyToken);
 assert.equal(typeof legacyOnly,'function');
});
