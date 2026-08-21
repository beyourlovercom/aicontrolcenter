import assert from 'node:assert/strict';
import {resolveEntityContext} from './entityContext.ts';
import {createProjectSnapshot} from '../model/projectModel.ts';

const prSnapshot=createProjectSnapshot({pullRequests:[{id:'pr-1',repository:'repo-a',status:'IN_PROGRESS'} as any]});

const scopeWithoutRevision={projectId:'aicc',repositoryIdentity:'repo-a'};
const noRevisionContext=resolveEntityContext(prSnapshot,{type:'pull_request',id:'pr-1'},undefined,undefined,scopeWithoutRevision as any);
assert.equal(noRevisionContext.type,'pull_request');
if(noRevisionContext.type==='pull_request'){
  assert.equal(noRevisionContext.record,null,'fallback PR projection is not fabricated without an exact projectContextRevision');
  assert.equal(noRevisionContext.currentStage,'UNAVAILABLE','absent projectContextRevision fails closed to the unbound PR presentation');
}

const exactRevisionContext=resolveEntityContext(prSnapshot,{type:'pull_request',id:'pr-1'},undefined,undefined,{projectId:'aicc',repositoryIdentity:'repo-a',projectContextRevision:0});
assert.equal(exactRevisionContext.type,'pull_request');
if(exactRevisionContext.type==='pull_request')assert.equal(exactRevisionContext.record?.id,'pr-1','an exact projectId+repositoryIdentity+projectContextRevision may build the fallback PR Layer 2 model');

console.log('PR fallback projection requires exact Project Context passed');
