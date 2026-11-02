import test from 'node:test';
import assert from 'node:assert/strict';
import {readDcRealCanaryReadiness,DC_CANARY_REQUIRED_EVIDENCE} from '../lib/dc-canary-readiness-v3.mjs';
import {assertDcAutomaticDispatchAllowed} from '../lib/dc-primary-gate-v3.mjs';
import {createAiccV3Server} from '../server.mjs';

test('Canary inventory is hard STOP and cannot be promoted by caller flags',()=>{
  const before=readDcRealCanaryReadiness({ownerApproved:true,realDispatchEnabled:true,
    signedHealthVerified:true,serviceOAuthDelegated:true});
  const after=readDcRealCanaryReadiness();
  assert.deepEqual(before,after);
  assert.equal(before.decision,'STOP');
  assert.equal(before.automaticDispatchAllowed,false);
  assert.equal(before.realCanaryExecuted,false);
  assert.equal(before.productionEnabled,false);
  assert.equal(before.prerequisites.length,6);
  assert.equal(DC_CANARY_REQUIRED_EVIDENCE.every(x=>x.state!=='PASS'),true);
  assert.throws(()=>assertDcAutomaticDispatchAllowed(),e=>e?.code==='DC_AUTO_DISPATCH_NOT_AUTHORIZED');
});
test('Canary API is read-only; fabricated real flags cannot create dispatch endpoint',async()=>{
  const env={AICC_EXECUTOR_GOVERNANCE_V3_ENABLED:'1',AICC_DC_AUTO_ADAPTER_REAL:'1',
    AICC_DC_REAL_DISPATCH:'1',AICC_DC_OWNER_APPROVED:'1',AICC_DC_SIGNED_HEALTH:'1'};
  const server=createAiccV3Server({env});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const base='http://127.0.0.1:'+server.address().port;
    const result=await fetch(base+'/api/dc-adapter/canary-readiness');
    assert.equal(result.status,200);
    const body=await result.json();
    assert.equal(body.decision,'STOP');
    assert.equal(body.automaticDispatchAllowed,false);
    const dispatch=await fetch(base+'/api/dc-adapter/dispatch',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({ownerApproved:true,signedHealthVerified:true})});
    assert.equal(dispatch.status,404);
    const prior=await fetch(base+'/api/runs',{method:'POST',
      headers:{'content-type':'application/json'},body:'{}'});
    assert.equal(prior.status,403);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
