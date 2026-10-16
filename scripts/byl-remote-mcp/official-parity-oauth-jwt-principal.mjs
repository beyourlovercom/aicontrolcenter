/**
 * A4.1 R3: candidate verifier for per-user OAuth JWTs.
 *
 * PURE/OPT-IN LIBRARY — NOT wired to a production listener or Operator Policy.
 * The private service owner must supply a trusted issuer key resolver, exact
 * issuer/audience/client/scope configuration and an independently controlled
 * hash allowlist. No tokens, keys, subjects or URLs are embedded in this repo.
 *
 * A legacy static Bearer is NEVER evidence of a verified user/operator.
 * A verified OAuth principal is a distinct kind, NOT 'cloudflare-access'.
 */
import {createHash} from 'node:crypto';
import {jwtVerify} from 'jose';

const ALGORITHMS=new Set(['RS256','PS256','ES256','EdDSA']);
const SCOPE=/^[a-zA-Z0-9:_./-]{1,120}$/;
const HEX=/^[0-9a-f]{64}$/;
const deny=()=>{throw Error('OAUTH_PRINCIPAL_DENIED');};
function httpsIdentity(x){
 if(typeof x!=='string'||x.length>400)return false;
 try{
  const u=new URL(x);
  return u.protocol==='https:'&&Boolean(u.hostname)&&!u.username&&!u.password&&
   !u.hash&&!u.search;
 }catch{return false;}
}
/** Hash includes a length-bounded exact issuer prefix to avoid same-subject cross-issuer aliasing. */
export function hashVerifiedOAuthSubject(issuer,subject){
 if(!httpsIdentity(issuer)||typeof subject!=='string'||
    subject.length<1||subject.length>512)deny();
 return createHash('sha256').update(issuer,'utf8').update('\n')
  .update(subject,'utf8').digest('hex');
}
/**
 * The key resolver must independently verify a signature with issuer-owned
 * signing keys, e.g. an owner-reviewed jose createRemoteJWKSet instance.
 * A JWT's unverified claims or its presence as a Bearer is not authentication.
 *
 * The returned principal is deliberately NOT compatible with the currently
 * installed Cloudflare-only Operator Policy. A separate reviewed policy
 * integration must be completed before Core-5 registration can use it.
 */
export function createVerifiedOAuthJwtPrincipalResolver({
 issuer,audience,keyResolver,algorithms,
 allowedClientIds,requiredBaseScope,requiredOperatorScope,
 allowedOperatorSubjectHashes=[]
}={}){
 if(!httpsIdentity(issuer)||!httpsIdentity(audience)||
    typeof keyResolver!=='function'||
    !Array.isArray(algorithms)||algorithms.length<1||algorithms.length>3||
    algorithms.some(a=>!ALGORITHMS.has(a))||
    new Set(algorithms).size!==algorithms.length||
    !Array.isArray(allowedClientIds)||allowedClientIds.length<1||
    allowedClientIds.length>10||allowedClientIds.some(c=>typeof c!=='string'||c.length<1||c.length>500)||
    new Set(allowedClientIds).size!==allowedClientIds.length||
    !SCOPE.test(requiredBaseScope)||!SCOPE.test(requiredOperatorScope)||
    requiredBaseScope===requiredOperatorScope||
    !Array.isArray(allowedOperatorSubjectHashes)||
    allowedOperatorSubjectHashes.length>100||
    allowedOperatorSubjectHashes.some(s=>!HEX.test(s))||
    new Set(allowedOperatorSubjectHashes).size!==allowedOperatorSubjectHashes.length)
  throw Error('OAUTH_PRINCIPAL_CONFIG_DENIED');

 const clients=new Set(allowedClientIds);
 const allowed=new Set(allowedOperatorSubjectHashes);

 return async function resolveVerifiedOAuthPrincipal(authorization){
  if(typeof authorization!=='string'||authorization.length>8199||
     !/^Bearer [A-Za-z0-9_.~-]+$/i.test(authorization))deny();
  const token=authorization.slice(7);
  let payload;
  try{
   ({payload}=await jwtVerify(token,keyResolver,{
    issuer,audience,algorithms,clockTolerance:'5s'
   }));
  }catch{deny();}
  // jose validates signatures/time/audience/issuer. Require explicit exp,
  // standard stable subject, exact authorized OAuth client and scopes too.
  if(!Number.isSafeInteger(payload?.exp)||payload.exp<1||
     typeof payload.sub!=='string'||payload.sub.length<1||
     payload.sub.length>512||
     typeof payload.client_id!=='string'||!clients.has(payload.client_id)||
     typeof payload.scope!=='string'||payload.scope.length<1||
     payload.scope.length>2048)deny();
  const scopes=new Set(payload.scope.split(' ').filter(Boolean));
  if(!scopes.has(requiredBaseScope))deny();
  const subjectHash=hashVerifiedOAuthSubject(issuer,payload.sub);
  const eligible=allowed.has(subjectHash)&&scopes.has(requiredOperatorScope);
  return Object.freeze({
   kind:'oauth-verified',
   canOperate:eligible,
   subjectHash:subjectHash.slice(0,24)
  });
 };
}
