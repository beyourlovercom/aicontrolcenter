import assert from 'node:assert/strict';
import {resolveWorkPackageLifecycle} from './lifecycleResolver.ts';
import {createProjectSnapshot} from '../model/projectModel.ts';
import {scopedEntityKey} from '../projectEntityScope.ts';

const aicc={projectId:'aicc',repositoryIdentity:'repo-a'};
const erp={projectId:'erpbeyourlovercom',repositoryIdentity:'repo-b'};
const snapshot=createProjectSnapshot({formalWorkPackages:{SAME_WP:{id:'SAME_WP',title:'Fixture',source:'fixture',fields:{REQUIRES_AUTHORIZATION:'no',IMPLEMENTATION:'COMPLETE',MACHINE_VALIDATION:'COMPLETE'},sections:{}}},humanUat:[{repository:'repo-a',workPackageId:'SAME_WP',entityType:'work_package',status:'PASS',items:[],createdAt:'2026-08-20T00:00:00.000Z',updatedAt:'2026-08-20T00:00:00.000Z',source:'fixture'}]});
const authorization={state:'UNAVAILABLE'} as any;
const aiccLifecycle=resolveWorkPackageLifecycle({id:'SAME_WP',identityKey:scopedEntityKey(aicc,'WORK_PACKAGE','SAME_WP')},aicc,'FORMAL_READY',authorization,snapshot);
const erpLifecycle=resolveWorkPackageLifecycle({id:'SAME_WP',identityKey:scopedEntityKey(erp,'WORK_PACKAGE','SAME_WP')},erp,'FORMAL_READY',authorization,snapshot);
assert.equal(aiccLifecycle.stages.find(stage=>stage.id==='HUMAN_UAT')?.status,'PASS');
assert.notEqual(erpLifecycle.stages.find(stage=>stage.id==='HUMAN_UAT')?.status,'PASS');
assert.throws(()=>resolveWorkPackageLifecycle({id:'SAME_WP',identityKey:'SAME_WP'},aicc,'FORMAL_READY',authorization,snapshot),/WP_PROJECT_SCOPE_REQUIRED/);
console.log('Phase 3 project-scoped WP lifecycle resolver passed');
