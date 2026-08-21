import assert from 'node:assert/strict';
import {availableSourceRevision,createEmptyGlobalStateReadModel,entityIdentity,explicitBinding,projectGlobalStateReadModel,projectionSource,sourceEntityIdentity} from './globalStateReadModel.ts';

const a={projectId:'aicc',repositoryIdentity:'beyourlovercom/aicontrolcenter',projectContextRevision:1} as const;
const b={projectId:'erpbeyourlovercom',repositoryIdentity:'beyourlovercom/erpbeyourlovercom',projectContextRevision:1} as const;
const task=(scope:typeof a)=>entityIdentity(scope,'TASK','SAME');
const source=(scope:typeof a,id:string)=>projectionSource(sourceEntityIdentity(scope,'TASK',id),availableSourceRevision('v1'));
const aTask=task(a),bTask=task(b);
assert.notEqual(`${aTask.projectId}:${aTask.repositoryIdentity}:${aTask.id}`,`${bTask.projectId}:${bTask.repositoryIdentity}:${bTask.id}`);
const aModel=projectGlobalStateReadModel(createEmptyGlobalStateReadModel(a),{entities:[{identity:aTask,dimensions:[]}],bindings:[]});
assert.equal(aModel.entities.length,1);
assert.throws(()=>projectGlobalStateReadModel(createEmptyGlobalStateReadModel(a),{entities:[{identity:bTask,dimensions:[]}],bindings:[]}),/FOREIGN_PROJECT_ENTITY/);
assert.throws(()=>explicitBinding('TASK_TO_EXECUTION',aTask,entityIdentity(b,'EXECUTION','SAME'),source(a,'SAME')),/CROSS_PROJECT_BINDING/);
assert.equal(source(a,'SAME').sourceEntity.projectId,'aicc');
console.log('Scoped Canonical Identity V2 isolation passed');
