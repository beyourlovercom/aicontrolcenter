import assert from 'node:assert/strict';
import {resolveLifecycleProgress,resolveMilestoneProgress} from './progress.ts';
const stage=(status:any,id:string)=>({id,label:id,status,evidence:[]});
assert.equal(resolveLifecycleProgress([stage('NOT_STARTED','A'),stage('COMPLETE','B')]),50);
assert.equal(resolveLifecycleProgress([stage('COMPLETE','A'),stage('N_A','B')]),100);
assert.equal(resolveLifecycleProgress([stage('WAITING_UAT','A'),stage('COMPLETE','B')]),50);
assert.equal(resolveMilestoneProgress([25,75]),50);
assert.equal(resolveMilestoneProgress([null,50]),50);
console.log('progress truth tests passed');
