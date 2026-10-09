/**
 * Cloudflare Access identity verifier for BYL MCP.
 * Opt-in: the production legacy bearer path is unchanged unless explicitly enabled.
 * This module never accepts unsigned identity headers or client opaque OAuth tokens.
 */
const EMAIL=/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;
const ACCESS_ISSUER=/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/;
let jwksCache;

export function getAccessConfig(env=process.env){
  if(env.BYL_MCP_ACCESS_ENABLED!=='1') return Object.freeze({enabled:false});
  const issuer=String(env.BYL_MCP_ACCESS_ISSUER||'').replace(/\/$/,'');
  const audience=String(env.BYL_MCP_ACCESS_AUDIENCE||'');
  const read=parseEmails(env.BYL_MCP_ACCESS_READ_EMAILS||'');
  const operate=parseEmails(env.BYL_MCP_ACCESS_OPERATE_EMAILS||'');
  if(!ACCESS_ISSUER.test(issuer)||!audience||audience.length>180||!read.size){
    throw Error('BYL_ACCESS_CONFIG_INVALID');
  }
  if([...operate].some(email=>!read.has(email)))throw Error('BYL_ACCESS_OPERATE_MUST_BE_READ_MEMBER');
  return Object.freeze({enabled:true,issuer,audience,read,operate});
}
function parseEmails(csv){
  const list=String(csv).split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  if(list.some(s=>!EMAIL.test(s)))throw Error('BYL_ACCESS_EMAIL_INVALID');
  return new Set(list);
}

/** jose verifies signature, algorithm, issuer, audience, temporal claims and key rotations. */
export async function verifyAccessJwt(assertion,config,{testJwks}={}){
  const {createRemoteJWKSet,jwtVerify}=await import('jose');
  const jwksUri=config.issuer+'/cdn-cgi/access/certs';
  if(!jwksCache||jwksCache.uri!==jwksUri){
    jwksCache={uri:jwksUri,keys:createRemoteJWKSet(new URL(jwksUri),{timeoutDuration:5000,cooldownDuration:30000})};
  }
  const {payload}=await jwtVerify(assertion,testJwks||jwksCache.keys,{
    algorithms:['RS256'],issuer:config.issuer,audience:config.audience,clockTolerance:'30s'
  });
  return payload;
}
function audienceMatches(audience,expected){
  return typeof audience==='string'?audience===expected:Array.isArray(audience)&&audience.includes(expected);
}

/**
 * Verify and authorize an Access identity. For tests only, supply a verifier
 * which must enforce signature, issuer and audience before returning claims.
 */
export async function resolveAccessPrincipal(assertion,config,verifier=verifyAccessJwt){
  if(!config?.enabled||typeof assertion!=='string'||assertion.length<30||assertion.length>16384||
    assertion.split('.').length!==3)throw Error('ACCESS_DENIED');
  let claims;
  try{claims=await verifier(assertion,config);}catch{throw Error('ACCESS_DENIED');}
  const now=Math.floor(Date.now()/1000);
  if(!claims||claims.iss!==config.issuer||!audienceMatches(claims.aud,config.audience)||
    typeof claims.exp!=='number'||claims.exp<=now-30||
    (typeof claims.nbf==='number'&&claims.nbf>now+30)||
    typeof claims.email!=='string')throw Error('ACCESS_DENIED');
  const email=claims.email.toLowerCase();
  if(!config.read.has(email))throw Error('ACCESS_DENIED');
  return Object.freeze({kind:'cloudflare-access',canOperate:config.operate.has(email)});
}
