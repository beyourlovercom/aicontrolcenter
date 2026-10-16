import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT} from 'jose';
import {
 createVerifiedOAuthJwtPrincipalResolver,
 hashVerifiedOAuthSubject
} from './official-parity-oauth-jwt-principal.mjs';

const ISS='https://oauth.example.test';
const AUD='https://mcp.example.test/oauth/mcp';
const CLIENT='https://chatgpt.com/oauth/synthetic-client';
async function fixture(){
 const {privateKey,publicKey}=await generateKeyPair('RS256',{extractable:true});
 const jwk=await exportJWK(publicKey);jwk.kid='SYNTHETIC_TEST_ONLY';
 const keyResolver=createLocalJWKSet({keys:[jwk]});
 const allowHash=hashVerifiedOAuthSubject(ISS,'operator-1');
 const config={
  issuer:ISS,audience:AUD,keyResolver,algorithms:['RS256'],
  allowedClientIds:[CLIENT],requiredBaseScope:'mcp.read',
  requiredOperatorScope:'dc.read',
  allowedOperatorSubjectHashes:[allowHash]
 };
 async function token({
  subject='operator-1',clientId=CLIENT,scope='mcp.read dc.read',
  issuer=ISS,audience=AUD,expired=false,signingKey=privateKey,
  attributes={}
 }={}){
  const now=Math.floor(Date.now()/1000);
  return new SignJWT({sub:subject,client_id:clientId,scope,...attributes})
   .setProtectedHeader({alg:'RS256',kid:'SYNTHETIC_TEST_ONLY'})
   .setIssuer(issuer).setAudience(audience)
   .setIssuedAt(now-(expired?600:2))
   .setNotBefore(now-(expired?600:2))
   .setExpirationTime(now+(expired?-300:300))
   .sign(signingKey);
 }
 return {config,token};
}
const authorize=(resolve,t)=>resolve('Bearer '+t);
const denied=async p=>assert.rejects(p,{message:'OAUTH_PRINCIPAL_DENIED'});

test('a cryptographically verified, scoped and allowlisted OAuth operator gets a distinct principal',async()=>{
 const f=await fixture();
 const resolve=createVerifiedOAuthJwtPrincipalResolver(f.config);
 const principal=await authorize(resolve,await f.token());
 assert.deepEqual(principal,{
  kind:'oauth-verified',
  canOperate:true,
  subjectHash:hashVerifiedOAuthSubject(ISS,'operator-1').slice(0,24)
 });
 assert(Object.isFrozen(principal));
 assert.notEqual(principal.kind,'cloudflare-access');
 assert.notEqual(principal.kind,'internal');
});
test('signed read-only and nonallowlisted subjects cannot become operators',async()=>{
 const f=await fixture(),resolve=createVerifiedOAuthJwtPrincipalResolver(f.config);
 const readonly=await authorize(resolve,await f.token({scope:'mcp.read'}));
 const outsider=await authorize(resolve,await f.token({subject:'not-an-operator'}));
 assert.equal(readonly.kind,'oauth-verified');
 assert.equal(readonly.canOperate,false);
 assert.equal(outsider.canOperate,false);
});
test('OAuth scope and client identity required even with a valid issuer signature',async()=>{
 const f=await fixture(),resolve=createVerifiedOAuthJwtPrincipalResolver(f.config);
 for(const changed of [
  {scope:'dc.read'}, {scope:'mcp.read-only dc.read'},
  {clientId:'https://not-approved.example.test'}
 ]){
  await denied(authorize(resolve,await f.token(changed)));
 }
});
test('issuer, audience and temporal signature checks fail closed',async()=>{
 const f=await fixture(),resolve=createVerifiedOAuthJwtPrincipalResolver(f.config);
 const different=await generateKeyPair('RS256');
 for(const changed of [
  {issuer:'https://evil.example.test'},
  {audience:'https://unrelated.example.test'},
  {expired:true},
  {signingKey:different.privateKey}
 ]){
  await denied(authorize(resolve,await f.token(changed)));
 }
});
test('an internal bearer, non-JWT, malformed or oversized credentials do not upgrade to operator',async()=>{
 const f=await fixture(),resolve=createVerifiedOAuthJwtPrincipalResolver(f.config);
 for(const header of [
  null,undefined,'','SYNTHETIC_SHARED_INTERNAL_BEARER',
  'Bearer SYNTHETIC_SHARED_INTERNAL_BEARER',
  'Basic test','Bearer ','Bearer a.b.c extra','Bearer '+('x'.repeat(8200))
 ]){
  await denied(resolve(header));
 }
});
test('validation rejects unsafe/incomplete runtime settings before any verifier or key use',async()=>{
 const f=await fixture();
 for(const config of [
  {...f.config,issuer:'http://insecure.example.test'},
  {...f.config,audience:'not-an-audience'},
  {...f.config,algorithms:['none']},
  {...f.config,algorithms:['RS256','RS256']},
  {...f.config,keyResolver:null},
  {...f.config,allowedClientIds:[]},
  {...f.config,requiredBaseScope:'mcp read'},
  {...f.config,allowedOperatorSubjectHashes:['not-a-sha256']},
  {...f.config,requiredOperatorScope:'mcp.read'}
 ]){
  assert.throws(()=>createVerifiedOAuthJwtPrincipalResolver(config),
   {message:'OAUTH_PRINCIPAL_CONFIG_DENIED'});
 }
});
test('private subjects never occur in the returned principal or error',async()=>{
 const f=await fixture();
 const resolve=createVerifiedOAuthJwtPrincipalResolver(f.config);
 const token=await f.token({subject:'private-user-subject',attributes:{email:'private@example.test'}});
 const principal=await authorize(resolve,token);
 const serialized=JSON.stringify(principal);
 assert(!serialized.includes('private-user-subject'));
 assert(!serialized.includes('private@example.test'));
 assert(!serialized.includes(token));
 assert.equal(principal.canOperate,false);
});
