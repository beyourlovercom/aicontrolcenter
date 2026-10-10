import {createHash,timingSafeEqual} from 'node:crypto';
import {createRemoteJWKSet,jwtVerify} from 'jose';

function fixedTokenEquals(supplied,expected){
 const a=createHash('sha256').update(supplied).digest();
 const b=createHash('sha256').update(expected).digest();
 return timingSafeEqual(a,b)&&supplied.length===expected.length;
}
export function validateAccessConfig(input){
 const team=String(input.team||'').trim().toLowerCase();
 const aud=String(input.audience||'').trim().toLowerCase();
 const owners=String(input.ownerEmails||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 if(!/^[a-z0-9-]{2,60}$/.test(team))throw Error('CF_TEAM_INVALID');
 if(!/^[0-9a-f]{64}$/.test(aud))throw Error('CF_AUDIENCE_INVALID');
 if(owners.length===0||owners.length>8||owners.some(x=>!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)))throw Error('CF_OWNERS_INVALID');
 if(new Set(owners).size!==owners.length)throw Error('CF_DUPLICATE_OWNER');
 return {issuer:'https://'+team+'.cloudflareaccess.com',audience:aud,ownerEmails:new Set(owners)};
}
export function makePrimaryAuthorizer({legacyToken,cloudflare,verifyAccessJwt}={}){
 if(typeof legacyToken!=='string'||legacyToken.length<32)throw Error('LEGACY_TOKEN_INVALID');
 if(cloudflare&&typeof verifyAccessJwt!=='function')throw Error('JWT_VERIFIER_REQUIRED');
 return async req=>{
  const header=req?.headers?.authorization||'';
  if(typeof header==='string'&&header.startsWith('Bearer ')&&fixedTokenEquals(header.slice(7),legacyToken)){
   return {ok:true,method:'legacy'};
  }
  if(!cloudflare)return {ok:false,reason:'UNAUTHORIZED'};
  const assertion=req?.headers?.['cf-access-jwt-assertion'];
  if(typeof assertion!=='string'||assertion.length<60||assertion.length>12000)return {ok:false,reason:'UNAUTHORIZED'};
  try{
   const claims=await verifyAccessJwt(assertion,cloudflare);
   const email=typeof claims?.email==='string'?claims.email.toLowerCase():'';
   if(!cloudflare.ownerEmails.has(email))return {ok:false,reason:'OWNER_DENIED'};
   return {ok:true,method:'cloudflare-access',actor:email};
  }catch{return {ok:false,reason:'JWT_INVALID'};}
 };
}
export async function verifyCloudflareAccessAssertion(raw,config,jwks){
 const {payload}=await jwtVerify(raw,jwks,{
  issuer:config.issuer,audience:config.audience,algorithms:['RS256'],
  requiredClaims:['exp','iat','sub'],clockTolerance:'10s',maxTokenAge:'24h'
 });
 return payload;
}
export function setupPrimaryAuthorizer(env,legacyToken){
 const fields=['CF_ACCESS_TEAM','CF_ACCESS_AUDIENCE','CF_ACCESS_OWNER_EMAILS'];
 const supplied=fields.filter(x=>Boolean(env[x]));
 if(supplied.length!==0&&supplied.length!==fields.length)throw Error('CF_AUTH_INCOMPLETE');
 const cloudflare=supplied.length?validateAccessConfig({
  team:env.CF_ACCESS_TEAM,audience:env.CF_ACCESS_AUDIENCE,ownerEmails:env.CF_ACCESS_OWNER_EMAILS
 }):null;
 const jwks=cloudflare?createRemoteJWKSet(new URL(cloudflare.issuer+'/cdn-cgi/access/certs')):null;
 const verifyAccessJwt=cloudflare?(raw,config)=>verifyCloudflareAccessAssertion(raw,config,jwks):undefined;
 return makePrimaryAuthorizer({legacyToken,cloudflare,verifyAccessJwt});
}
