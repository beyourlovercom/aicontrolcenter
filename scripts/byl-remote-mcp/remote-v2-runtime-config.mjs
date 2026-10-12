// Pure, fail-closed runtime configuration parser. No production wiring in this candidate.
const ID=/^[a-z][a-z0-9-]{1,63}$/;
const KEYS=new Set(['us-macmini','china-mac','windows']);
export function parseRuntimeTargets(input) {
  if (!input || typeof input!=='object' || Array.isArray(input)) throw new TypeError('TARGET_CONFIG_INVALID');
  const entries=Object.entries(input);
  if(entries.length===0 || entries.length>3) throw new TypeError('TARGET_COUNT_INVALID');
  const result=Object.create(null);
  for (const [id, value] of entries) {
    if(!ID.test(id)||!KEYS.has(id)||!value||typeof value!=='object'||Array.isArray(value)) throw new TypeError('TARGET_INVALID');
    if(Object.keys(value).some(key=>!['kind','upstream'].includes(key))) throw new TypeError('TARGET_FIELDS_INVALID');
    if(!['dc-agent','aicc-runner'].includes(value.kind)) throw new TypeError('TARGET_KIND_INVALID');
    if(typeof value.upstream!=='string') throw new TypeError('TARGET_URL_INVALID');
    let url;
    try {url=new URL(value.upstream);} catch {throw new TypeError('TARGET_URL_INVALID');}
    if(url.protocol!=='http:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||!url.hostname||!/^\d{2,5}$/.test(url.port)) throw new TypeError('TARGET_URL_INVALID');
    // Only fixed private IPv4 peer endpoints; disallow DNS resolution, loopback, localhost and arbitrary external hosts.
    const octets=url.hostname.split('.').map(Number);
    if(octets.length!==4||octets.some(x=>!Number.isInteger(x)||x<0||x>255)||!(octets[0]===100 && octets[1]>=64 && octets[1]<=127)) throw new TypeError('TARGET_PEER_INVALID');
    if(!((value.kind==='dc-agent'&&url.port==='8791')||(value.kind==='aicc-runner'&&url.port==='8787'))) throw new TypeError('TARGET_PORT_INVALID');
    result[id]=Object.freeze({id,kind:value.kind,upstream:url.origin});
  }
  return Object.freeze(result);
}
export function registeredTargets(config) {
  return Object.values(config).map(({id,kind})=>({id,kind,state:'registered',live:'unknown'}));
}
