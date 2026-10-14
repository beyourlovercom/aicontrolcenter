/**
 * DC Dev Deploy V1 — pure orchestration boundary, no SSH, shell or filesystem I/O.
 * Production wiring MUST supply durable lock/store and trusted GitHub/Owner/CI
 * attestation + path-bound Dev receiver with independent safety approval.
 */
import {DEV_PROJECTS,validateDevManifest,manifestDigest,assertTrustedAttestation} from './dev-allowlist-contract.mjs';
function deny(code){throw Object.assign(new Error(code),{code});}
const SHA=/^[a-f0-9]{64}$/;
function assertMethod(o,n){if(typeof o?.[n]!=='function')deny('ADAPTER_NOT_CONFIGURED');}
function snapshot(received,files,phase){
  if(received===null||typeof received!=='object'||Array.isArray(received)||
    Object.keys(received).length!==files.length)deny('INSPECTION_INVALID');
  for(const f of files){
    const s=received[f.path];
    if(!s||s.site!=='dev.beyourlover.com'||s.realpathSafe!==true||s.symlinkFree!==true||
      !(s.sha256===null||(typeof s.sha256==='string'&&SHA.test(s.sha256))))
      deny('SITE_IDENTITY_OR_PATH_DENIED');
    const expected=phase==='before'?f.beforeSha256:f.afterSha256;
    if(s.sha256!==expected)deny('FILE_DRIFT_DENIED');
  }
}
function receiptEquals(rec,m,digest){
  if(!rec||rec.releaseId!==m.releaseId||rec.digest!==digest||
     rec.ownerReceipt!==m.authorizationReceipt)deny('RELEASE_REPLAY_CONFLICT');
}
export function createDevReleaseService({registry=DEV_PROJECTS,authority,receiver,store}={}){
  for(const n of ['attest','canView'])assertMethod(authority,n);
  for(const n of ['inspect','prepare','apply','restore'])assertMethod(receiver,n);
  for(const n of ['withProjectLock','get','put'])assertMethod(store,n);
  async function attest(m,digest,action){
    const a=await authority.attest({action,manifest:m,manifestSha256:digest});
    assertTrustedAttestation(m,digest,a);
  }
  function normalize(input){const m=validateDevManifest(input,registry);return {m,digest:manifestDigest(m)};}
  async function inspect(m,phase){
    snapshot(await receiver.inspect({project:m.project,files:m.files}),m.files,phase);
  }
  const service={
    async prepare(input){
      const {m,digest}=normalize(input);
      return store.withProjectLock(m.project,async()=>{
        const existing=await store.get(m.project,m.releaseId);
        if(existing){receiptEquals(existing,m,digest);return existing;}
        await attest(m,digest,'prepare');
        await inspect(m,'before');
        // Stages immutable artifacts + creates VERIFIED backup outside Web root.
        // Must not modify running WordPress files.
        const backup=await receiver.prepare({manifest:m,manifestSha256:digest});
        if(!backup||backup.verified!==true||typeof backup.backupId!=='string'||
           !/^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/.test(backup.backupId))
           deny('BACKUP_NOT_VERIFIED');
        await inspect(m,'before');
        const rec=Object.freeze({project:m.project,releaseId:m.releaseId,digest,
          ownerReceipt:m.authorizationReceipt,backupId:backup.backupId,state:'PREPARED'});
        await store.put(rec);
        return rec;
      });
    },
    async apply(input){
      const {m,digest}=normalize(input);
      return store.withProjectLock(m.project,async()=>{
        const prev=await store.get(m.project,m.releaseId);
        receiptEquals(prev,m,digest);
        if(prev.state==='APPLIED'){await inspect(m,'after');return prev;}
        if(prev.state!=='PREPARED')deny('RELEASE_STATE_DENIED');
        await attest(m,digest,'apply'); // Recheck HEAD, CI, Owner TTL and artifact.
        await inspect(m,'before');       // Reject Dev runtime drift since prepare.
        // Durable intent precedes any side effect. Incomplete APPLYING is never auto-retried.
        await store.put(Object.freeze({...prev,state:'APPLYING'}));
        try{
          await receiver.apply({manifest:m,manifestSha256:digest,backupId:prev.backupId});
          await inspect(m,'after');
        }catch(err){
          // Receiver must attest a safe atomic restore; NEVER assume partial writes
          // or external interference can be silently rolled back.
          try{
            const result=await receiver.restore({manifest:m,backupId:prev.backupId,
              reason:'apply_failed',strictIdentity:true});
            if(result?.restored!==true)throw Error('RESTORE_NOT_VERIFIED');
            await inspect(m,'before');
            const rolled=Object.freeze({...prev,state:'ROLLED_BACK'});
            await store.put(rolled);
          }catch{
            await store.put(Object.freeze({...prev,state:'MANUAL_RECOVERY_REQUIRED'}));
            deny('APPLY_FAILED_MANUAL_RECOVERY');
          }
          deny('APPLY_FAILED_ROLLED_BACK');
        }
        const done=Object.freeze({...prev,state:'APPLIED'});
        await store.put(done);
        return done;
      });
    },
    async rollback(input){
      const {m,digest}=normalize(input);
      return store.withProjectLock(m.project,async()=>{
        const prev=await store.get(m.project,m.releaseId);
        receiptEquals(prev,m,digest);
        if(prev.state==='ROLLED_BACK')return prev;
        if(prev.state!=='APPLIED')deny('RELEASE_STATE_DENIED');
        await attest(m,digest,'rollback');
        await inspect(m,'after');
        // No automatic replay of interrupted rollback; Owner must reconcile it.
        await store.put(Object.freeze({...prev,state:'ROLLING_BACK'}));
        try{
          await inspect(m,'after');
          const result=await receiver.restore({manifest:m,backupId:prev.backupId,
            reason:'owner_rollback',strictIdentity:true});
          if(result?.restored!==true)deny('ROLLBACK_FAILED');
          await inspect(m,'before');
        }catch{
          await store.put(Object.freeze({...prev,state:'MANUAL_RECOVERY_REQUIRED'}));
          deny('ROLLBACK_FAILED_MANUAL_RECOVERY');
        }
        const done=Object.freeze({...prev,state:'ROLLED_BACK'});
        await store.put(done);
        return done;
      });
    },
    async status({project,releaseId,principal}={}){
      if(!Object.hasOwn(registry,project)||typeof releaseId!=='string'||
         !/^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/.test(releaseId))
         deny('STATUS_SCOPE_DENIED');
      if(await authority.canView({project,releaseId,principal})!==true)
        deny('STATUS_AUTH_DENIED');
      // Never expose backup filesystem paths, credentials or request payloads.
      const rec=await store.get(project,releaseId);
      return rec?{project,releaseId,state:rec.state,digest:rec.digest}:null;
    }
  };
  return Object.freeze(service);
}
