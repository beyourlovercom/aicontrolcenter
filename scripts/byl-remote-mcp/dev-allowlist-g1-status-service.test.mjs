import test from 'node:test';
import assert from 'node:assert/strict';
import {createG1StatusOnlyService} from './dev-allowlist-g1-status-service.mjs';
const scope={project:'byl-wordpress-core',releaseId:'g1-20261015-status',principal:{sub:'verified'}};
test('G1 status is permanently NOT_ENABLED, never a release receipt',async()=>{
 const service=createG1StatusOnlyService();
 assert.deepEqual(await service.status(scope),{
  project:scope.project,releaseId:scope.releaseId,state:'NOT_ENABLED',digest:null
 });
 assert.equal(Object.isFrozen(service),true);
});
test('G1 bootstrap status rejects missing principal and wrong environment scope',async()=>{
 const service=createG1StatusOnlyService();
 await assert.rejects(service.status({...scope,principal:null}),{message:'G1_STATUS_AUTH_REQUIRED'});
 await assert.rejects(service.status({...scope,project:'www.beyourlover.com'}),{message:'G1_STATUS_SCOPE_DENIED'});
 await assert.rejects(service.status({...scope,releaseId:'../escape'}),{message:'G1_STATUS_SCOPE_DENIED'});
});
test('G1 status service refuses prepare/apply/rollback unconditionally',async()=>{
 const service=createG1StatusOnlyService();
 for(const action of ['prepare','apply','rollback'])
  await assert.rejects(service[action]({}),{message:'G1_MUTATION_DISABLED'});
});
test('G1 bootstrap has no injectable release state and returns no backup or secret paths',async()=>{
 const service=createG1StatusOnlyService();
 const value=await service.status({...scope,manifest:{allowMutatingTools:true}});
 const serialized=JSON.stringify(value);
 assert.equal(value.state,'NOT_ENABLED');
 assert.equal('backupId' in value,false);
 assert.equal('artifact' in value,false);
 assert.equal(serialized.includes('wp-content'),false);
});
