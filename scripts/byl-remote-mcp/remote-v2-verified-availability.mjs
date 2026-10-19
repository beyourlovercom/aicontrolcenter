/**
 * Read-only device availability view for a *future* MCP/Dev adapter.
 *
 * Reuses already-merged signed health and bounded TTL monitor. Deliberately
 * never emits legacy static READY, never performs IO itself, and never treats
 * an operational hostname selftest as a signed agent health proof.
 *
 * The caller MUST externally attest/enroll per-device public keys. Cryptographic
 * verification with keys supplied to this constructor alone does not prove trust.
 * Not deployed in the existing running Gateway or Agent.
 */
import {createLiveHealthMonitor} from './remote-v2-live-health.mjs';
import {createSignedDeviceProbe} from './remote-v2-signed-health.mjs';

const ID=/^[a-z0-9-]{2,40}$/;
const own=(value,key)=>Object.hasOwn(value,key);
const frozen=v=>Object.freeze(v);

/** Categorizes only a bounded error class. Never repeats provider text or secrets. */
export function classifyDcControlPlaneFailure(failure) {
  const message=typeof failure==='string'?failure:
    typeof failure?.message==='string'?failure.message:'';
  const sample=message.slice(0,2048);
  if (/reached this month's Desktop Commander usage|Desktop Commander usage.*paused/i.test(sample))
    return 'OLD_DC_PROVIDER_QUOTA_EXHAUSTED';
  if (/此工具调用被 OpenAI 的安全检查屏蔽|blocked by OpenAI.{0,40}safety|OpenAI.{0,40}safety check/i.test(sample))
    return 'CHATGPT_PLATFORM_SAFETY_BLOCK';
  if (/无法加载插件设置|could not load plugin settings|failed to load plugin settings/i.test(sample))
    return 'CHATGPT_SETTINGS_UI_FAILURE_UNATTRIBUTED';
  return 'UNCLASSIFIED_FAILURE';
}

const missing=id=>frozen({
  id,registered:true,state:'unknown',verified:false,reason:'TRUST_KEY_NOT_ENROLLED',
  checkedAt:null,latencyMs:null,cache:'not_checked',probe:'not_performed'
});

/**
 * Explicit opt-in refresh only; no polling/schedulers.
 * registry is a fixed list of device IDs, not caller-selected URLs.
 * publicKeys must be supplied only after independent enrollment/identity proof.
 * transport injected by an approved service owner; never receives arbitrary URL.
 */
export function createDeviceAvailabilityAdapter({
  registry,publicKeys={},transport,clock=Date.now,ttlMs=15000,timeoutMs=2500,maxConcurrency=3
}={}) {
  if (!registry||typeof registry!=='object'||Array.isArray(registry) ||
      Object.getPrototypeOf(registry)!==Object.prototype)
    throw Error('REGISTRY_REQUIRED');
  const ids=Object.keys(registry);
  if (ids.length===0||ids.length>25||ids.some(id=>!ID.test(id)))
    throw Error('REGISTRY_INVALID');
  if (!publicKeys||typeof publicKeys!=='object'||Array.isArray(publicKeys) ||
      Object.getPrototypeOf(publicKeys)!==Object.prototype)
    throw Error('TRUST_STORE_INVALID');
  if (typeof transport!=='function')throw Error('APPROVED_TRANSPORT_REQUIRED');
  if (typeof clock!=='function')throw Error('CLOCK_INVALID');
  // Never trust or probe keys for a device not in the fixed registry.
  if (Object.keys(publicKeys).some(id=>!own(registry,id)))
    throw Error('UNREGISTERED_TRUST_KEY');
  const configured=Object.fromEntries(ids.filter(id=>own(publicKeys,id))
    .map(id=>[id,registry[id]]));
  const signed=Object.keys(configured).length?
    createSignedDeviceProbe({transport,publicKeys,clock}):null;
  const monitor=signed?createLiveHealthMonitor({
    registry:configured,probeDevice:signed,clock,ttlMs,timeoutMs,maxConcurrency
  }):null;

  function present(record) {
    return frozen({
      id:record.id,registered:true,
      state:record.state,verified:record.verified===true,
      reason:record.reason,checkedAt:record.checkedAt??null,
      latencyMs:record.latencyMs??null,cache:record.cache??'not_checked',
      probe:record.verified===true?'SIGNED_RESPONSE_VERIFIED':
        record.reason==='NOT_CHECKED'?'not_performed':'NOT_VERIFIED'
    });
  }
  function peek() {
    const available=new Map((monitor?.peek()||[]).map(x=>[x.id,x]));
    return frozen(ids.map(id=>available.has(id)?
      present(available.get(id)):missing(id)));
  }
  async function refresh({force=false}={}) {
    // Any actual transport call requires an explicitly enrolled device key.
    if(monitor)await monitor.list({force});
    return peek();
  }
  // No method to export secrets, invoke shell, install Agent or change services.
  return frozen({peek,refresh});
}
