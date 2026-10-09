import test from 'node:test';
import assert from 'node:assert/strict';
import {getAccessConfig,resolveAccessPrincipal} from './access-auth.mjs';

const now=()=>Math.floor(Date.now()/1000);
const jwt='a'.repeat(20)+'.'+'b'.repeat(20)+'.'+'c'.repeat(20);
const configured=()=>getAccessConfig({
 BYL_MCP_ACCESS_ENABLED:'1',
 BYL_MCP_ACCESS_ISSUER:'https://byl-test.cloudflareaccess.com',
 BYL_MCP_ACCESS_AUDIENCE:'only-test-audience-not-real',
 BYL_MCP_ACCESS_READ_EMAILS:'read@example.test, operator@example.test',
 BYL_MCP_ACCESS_OPERATE_EMAILS:'operator@example.test'
});
const claims=(email='read@example.test')=>({
  iss:'https://byl-test.cloudflareaccess.com',aud:['only-test-audience-not-real'],
  exp:now()+600,nbf:now()-60,email
});
const fakeVerifier=payload=>async()=>payload;

test('Access disabled by default without issuer or audience',()=>{
  assert.deepEqual(getAccessConfig({}),{enabled:false});
});
test('Enabled Access refuses incomplete or non-Cloudflare issuers',()=>{
  assert.throws(()=>getAccessConfig({BYL_MCP_ACCESS_ENABLED:'1'}),/CONFIG_INVALID/);
  assert.throws(()=>getAccessConfig({...{
    BYL_MCP_ACCESS_ENABLED:'1',BYL_MCP_ACCESS_ISSUER:'http://localhost:1234',
    BYL_MCP_ACCESS_AUDIENCE:'test',BYL_MCP_ACCESS_READ_EMAILS:'a@example.test'
  }}),/CONFIG_INVALID/);
});
test('Operate must be included in read allowlist',()=>{
  assert.throws(()=>getAccessConfig({
    BYL_MCP_ACCESS_ENABLED:'1',BYL_MCP_ACCESS_ISSUER:'https://byl-test.cloudflareaccess.com',
    BYL_MCP_ACCESS_AUDIENCE:'test',BYL_MCP_ACCESS_READ_EMAILS:'a@example.test',
    BYL_MCP_ACCESS_OPERATE_EMAILS:'b@example.test'
  }),/OPERATE_MUST_BE_READ_MEMBER/);
});
test('Read-only user cannot operate while operator can',async()=>{
  const config=configured();
  const read=await resolveAccessPrincipal(jwt,config,fakeVerifier(claims()));
  assert.equal(read.canOperate,false);
  const op=await resolveAccessPrincipal(jwt,config,fakeVerifier(claims('OPERATOR@EXAMPLE.TEST')));
  assert.equal(op.canOperate,true);
});
test('Reject missing, malformed and disabled Access assertions',async()=>{
  await assert.rejects(resolveAccessPrincipal('',configured(),fakeVerifier(claims())),/ACCESS_DENIED/);
  await assert.rejects(resolveAccessPrincipal('opaque-not-jwt',configured(),fakeVerifier(claims())),/ACCESS_DENIED/);
  await assert.rejects(resolveAccessPrincipal(jwt,{enabled:false},fakeVerifier(claims())),/ACCESS_DENIED/);
});
test('Reject outsider, wrong issuer, wrong audience and expired token',async()=>{
  for(const bad of [
    claims('outsider@example.test'),
    {...claims(),iss:'https://evil.example.test'},
    {...claims(),aud:'another-audience'},
    {...claims(),exp:now()-100},
    {...claims(),nbf:now()+300},
    {...claims(),email:null}
  ])await assert.rejects(resolveAccessPrincipal(jwt,configured(),fakeVerifier(bad)),/ACCESS_DENIED/);
});
test('Verifier signature failure must fail closed without leaking details',async()=>{
  await assert.rejects(resolveAccessPrincipal(jwt,configured(),async()=>{throw Error('SECRET_ERROR_DETAILS')}),e=>{
    assert.equal(e.message,'ACCESS_DENIED');
    return true;
  });
});
