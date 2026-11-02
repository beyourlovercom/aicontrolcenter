/** R6-C: synthetic single-device rehearsal ONLY. Never uses DC transport/OAuth. */
import {createHash} from 'node:crypto';
import {evaluateDevSignedEvidence} from './dc-signed-evidence-sandbox-v3.mjs';
import {evaluateDevProofSeparation,verifySyntheticServiceEvidence,validateR6BTypedSelftestIntent} from './dc-r6b-service-proof-dev.mjs';
import {reserveDevRequest,stageSyntheticAttempt,recordSyntheticReceipt} from './dc-r6b-ledger-dev.mjs';
export const R6C_BOUND=Object.freeze(['nonce','projectId','workPackageId','taskId','repositoryIdentity','head','deviceId','operation']);
function stop(code){const error=new Error(code);error.code=code;throw error;}
function exact(o,keys){return !!o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));}
export function r6cScopeDigest(plan){
 if(!plan||!R6C_BOUND.every(k=>typeof plan[k]==='string'))stop('R6C_SCOPE_INVALID');
 return createHash('sha256').update(JSON.stringify(Object.fromEntries(R6C_BOUND.map(k=>[k,plan[k]])))).digest('hex');
}
export function r6cReadOnlyStatus(){return Object.freeze({
 schema:'aicc.v3b.r6c-dev-rehearsal.v1',mode:'NO_DEVICE_CALL_SYNTHETIC_ONLY',
 deviceId:'us-macmini',operation:'remote_process_selftest',realCanaryCalls:0,
 decision:'STOP',automaticDispatchAllowed:false,realCanaryExecuted:false,
 runtimeOAuthDelegated:false,trustedDeviceHealth:false,
 independentOwnerAuthorization:false,remoteReceiptVerified:false,productionEnabled:false});
}
export function rehearseR6CDevOnly(input){
 const keys=['root','plan','nowMs','ownerHealth','ownerRoot','healthRoot','serviceProof','serviceRoot'];
 if(!exact(input,keys))stop('R6C_INPUT_DENIED');
 const {root,plan,nowMs,ownerHealth,ownerRoot,healthRoot,serviceProof,serviceRoot}=input;
 if(!Number.isSafeInteger(nowMs)||!plan||plan.scopeDigest!==r6cScopeDigest(plan))stop('R6C_SCOPE_INVALID');
 validateR6BTypedSelftestIntent({deviceId:plan.deviceId,operation:plan.operation,arguments:{}});
 const binding=Object.fromEntries(R6C_BOUND.map(k=>[k,plan[k]]));
 const owner=evaluateDevSignedEvidence(ownerHealth,{ownerRoot,healthRoot},binding,{nowMs});
 if(owner.decision!=='STOP'||owner.evidenceSource!=='CALLER_INJECTED_DEV_TEST_KEYS')stop('R6C_SYNTHETIC_OWNER_REQUIRED');
 const roles=evaluateDevProofSeparation(ownerRoot.publicKey,healthRoot.publicKey,serviceRoot.publicKey);
 if(roles.decision!=='STOP')stop('R6C_ROLE_DENIED');
 const service=verifySyntheticServiceEvidence(serviceProof,serviceRoot,binding,nowMs);
 if(service.decision!=='STOP'||service.runtimeOAuthDelegated!==false)stop('R6C_SYNTHETIC_SERVICE_REQUIRED');
 const prepared=reserveDevRequest(root,plan,nowMs);
 const staged=stageSyntheticAttempt(root,prepared.requestId,nowMs);
 const fakeReceipt={source:'SYNTHETIC_ONLY',requestId:plan.requestId,nonce:plan.nonce,
  planDigest:staged.planDigest,deviceId:plan.deviceId,operation:plan.operation,
  resultDigest:createHash('sha256').update('NO_DEVICE_CALL\n'+staged.planDigest).digest('hex'),ok:true};
 const done=recordSyntheticReceipt(root,plan.requestId,fakeReceipt,nowMs);
 if(done.state!=='SYNTHETIC_COMPLETED')stop('R6C_REHEARSAL_UNCERTAIN_STOP');
 return Object.freeze({...r6cReadOnlyStatus(),rehearsalState:done.state,
  planDigest:done.planDigest,syntheticReceiptDigest:done.receiptDigest,syntheticAttempts:done.syntheticAttempts});
}
