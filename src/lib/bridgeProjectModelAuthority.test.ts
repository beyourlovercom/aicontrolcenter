import assert from 'node:assert/strict';
import {projectTaskModelForContext,type ActiveTaskProjectContext} from './bridgeCore.ts';

const task=(projectId:string,repositoryIdentity:string)=>({
  taskId:'SAME',projectId,repositoryIdentity,status:'READY',executionId:undefined,runId:undefined
} as any);
const registry=(record:any)=>({items:[record],legacy:[]});
const context=(projectId:string,repositoryIdentity:string,projectContextRevision:number):ActiveTaskProjectContext=>({projectId,repositoryIdentity,projectContextRevision});
const a1=context('a','repo-a',1),b2=context('b','repo-b',2),a3=context('a','repo-a',3);
const aModel=projectTaskModelForContext(a1,registry(task('a','repo-a')),[]);
const bModel=projectTaskModelForContext(b2,registry(task('b','repo-b')),[]);
const aAgain=projectTaskModelForContext(a3,registry(task('a','repo-a')),[]);
assert.equal(aModel.projectId,'a');
assert.equal(aModel.projectContextRevision,1);
assert.equal(bModel.projectId,'b');
assert.equal(bModel.projectContextRevision,2);
assert.equal(aAgain.projectId,'a');
assert.equal(aAgain.projectContextRevision,3);
assert.equal(aModel.entities.some(entity=>entity.identity.projectId==='b'),false);
assert.equal(bModel.entities.some(entity=>entity.identity.projectId==='a'),false);
assert.equal(aAgain.entities.every(entity=>entity.identity.projectId==='a'),true);
console.log('Bridge project-scoped model authority A-B-A passed');
