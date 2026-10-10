import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,SignJWT,createLocalJWKSet} from 'jose';
import {validateAccessConfig,verifyCloudflareAccessAssertion} from './gui-managed-access-auth.mjs';
test('Cloudflare assertion: RSA signature, issuer, audience and expiration enforced',async()=>{
 const {privateKey,publicKey}=await generateKeyPair('RS256');
 const jwk=await exportJWK(publicKey);
 jwk.kid='cloudflare-test-kid';jwk.use='sig';jwk.alg='RS256';
 const keys=createLocalJWKSet({keys:[jwk]});
 const cfg=validateAccessConfig({team:'team-test',audience:'b'.repeat(64),ownerEmails:'owner@example.com'});
 const issue=(opts={})=>new SignJWT({email:'owner@example.com'}).setProtectedHeader({alg:'RS256',kid:jwk.kid})
  .setIssuer(opts.issuer||cfg.issuer).setAudience(opts.audience||cfg.audience)
  .setSubject('owner123').setIssuedAt().setExpirationTime(opts.expire||'5m').sign(privateKey);
 const valid=await issue();
 assert.equal((await verifyCloudflareAccessAssertion(valid,cfg,keys)).email,'owner@example.com');
 await assert.rejects(()=>verifyCloudflareAccessAssertion(valid,{...cfg,audience:'c'.repeat(64)},keys));
 await assert.rejects(()=>verifyCloudflareAccessAssertion(valid,{...cfg,issuer:'https://different.cloudflareaccess.com'},keys));
 const expired=await issue({expire:'-2h'});
 await assert.rejects(()=>verifyCloudflareAccessAssertion(expired,cfg,keys));
 const tampered=valid.slice(0,-2)+(valid.endsWith('X')?'Y':'X')+valid.slice(-1);
 await assert.rejects(()=>verifyCloudflareAccessAssertion(tampered,cfg,keys));
});
