import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,SignJWT,createLocalJWKSet} from 'jose';
import {verifyAccessJwt,resolveAccessPrincipal,getAccessConfig} from './access-auth.mjs';

test('Cryptographic Access JWT validation enforces RS256 signature, issuer and audience',async()=>{
  const {publicKey,privateKey}=await generateKeyPair('RS256');
  const jwk=await exportJWK(publicKey);
  jwk.kid='test-key';
  jwk.alg='RS256';jwk.use='sig';
  const resolver=createLocalJWKSet({keys:[jwk]});
  const config=getAccessConfig({
    BYL_MCP_ACCESS_ENABLED:'1',
    BYL_MCP_ACCESS_ISSUER:'https://byl-test.cloudflareaccess.com',
    BYL_MCP_ACCESS_AUDIENCE:'only-test-aud',
    BYL_MCP_ACCESS_READ_EMAILS:'tester@example.test',
    BYL_MCP_ACCESS_OPERATE_EMAILS:''
  });
  const sign=async({aud='only-test-aud',iss=config.issuer,email='tester@example.test'}={})=>
    new SignJWT({email})
      .setProtectedHeader({alg:'RS256',kid:'test-key'})
      .setIssuer(iss).setAudience(aud).setIssuedAt()
      .setExpirationTime('10m').sign(privateKey);
  const good=await sign();
  const claims=await verifyAccessJwt(good,config,{testJwks:resolver});
  assert.equal(claims.email,'tester@example.test');
  const principal=await resolveAccessPrincipal(good,config,(token,conf)=>verifyAccessJwt(token,conf,{testJwks:resolver}));
  assert.equal(principal.canOperate,false);
  await assert.rejects(verifyAccessJwt(await sign({aud:'evil'}),config,{testJwks:resolver}));
  await assert.rejects(verifyAccessJwt(await sign({iss:'https://evil.example.test'}),config,{testJwks:resolver}));
  const attacker=await generateKeyPair('RS256');
  const badSig=await new SignJWT({email:'tester@example.test'})
    .setProtectedHeader({alg:'RS256',kid:'test-key'})
    .setIssuer(config.issuer).setAudience(config.audience).setIssuedAt().setExpirationTime('10m')
    .sign(attacker.privateKey);
  await assert.rejects(verifyAccessJwt(badSig,config,{testJwks:resolver}));
});
