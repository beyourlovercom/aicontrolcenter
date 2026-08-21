import assert from 'node:assert/strict';
import {scopeInboxToEntity,scopeOutboxToWorkPackage,scopeRunsToWorkPackage,scopeTasksToEntity} from './entityScope.ts';

const aicc={projectId:'aicc',repositoryIdentity:'repo-a'};
const erp={projectId:'erpbeyourlovercom',repositoryIdentity:'repo-b'};
const entity={type:'work_package' as const,id:'SAME_WP'};
const inbox=[
  {projectId:'aicc',repositoryIdentity:'repo-a',instruction:{projectId:'aicc',repositoryIdentity:'repo-a',workPackageId:'SAME_WP'}},
  {projectId:'erpbeyourlovercom',repositoryIdentity:'repo-b',instruction:{projectId:'erpbeyourlovercom',repositoryIdentity:'repo-b',workPackageId:'SAME_WP'}}
];
const tasks=[
  {projectId:'aicc',repositoryIdentity:'repo-a',formalWpId:'SAME_WP'},
  {projectId:'erpbeyourlovercom',repositoryIdentity:'repo-b',formalWpId:'SAME_WP'}
];
const runs=[{projectId:'aicc',repositoryIdentity:'repo-a',workPackageId:'SAME_WP'},{projectId:'erpbeyourlovercom',repositoryIdentity:'repo-b',workPackageId:'SAME_WP'}];
const outbox=[{projectId:'aicc',repositoryIdentity:'repo-a',report:{workPackageId:'SAME_WP'}},{projectId:'erpbeyourlovercom',repositoryIdentity:'repo-b',report:{workPackageId:'SAME_WP'}}];
assert.equal(scopeInboxToEntity(inbox,entity,aicc).length,1);assert.equal(scopeInboxToEntity(inbox,entity,erp).length,1);
assert.equal(scopeTasksToEntity(tasks,entity,aicc).length,1);assert.equal(scopeTasksToEntity(tasks,entity,erp).length,1);
assert.equal(scopeRunsToWorkPackage(runs,'SAME_WP',aicc).length,1);assert.equal(scopeOutboxToWorkPackage(outbox,'SAME_WP',erp).length,1);
assert.equal(scopeInboxToEntity(inbox,entity).length,0);assert.equal(scopeTasksToEntity(tasks,entity).length,0);
console.log('Phase 3 project-scoped WP entity scope passed');
