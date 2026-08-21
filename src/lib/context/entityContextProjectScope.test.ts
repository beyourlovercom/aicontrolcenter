import assert from 'node:assert/strict';
import {resolveEntityContext} from './entityContext.ts';
import {createEmptyGlobalStateReadModel} from '../globalStateReadModel.ts';
import {createProjectSnapshot} from '../model/projectModel.ts';
import {projectWpLayer2} from '../wpCanonicalProjection.ts';

const aicc={projectId:'aicc',repositoryIdentity:'repo-a',projectContextRevision:0};
const erp={projectId:'erpbeyourlovercom',repositoryIdentity:'repo-b',projectContextRevision:1};
const snapshot=createProjectSnapshot({roadmap:{source:'fixture',content:'## Active V2 Milestones\n### M1 — Fixture\nWork Packages: `SAME_WP`\n`SAME_WP` — `PLANNED`; Fixture.'},formalWorkPackages:{}});
const aiccProjection=projectWpLayer2(createEmptyGlobalStateReadModel(aicc),snapshot,[],aicc);
const erpProjection=projectWpLayer2(createEmptyGlobalStateReadModel(erp),snapshot,[],erp);
assert.equal(resolveEntityContext(snapshot,{type:'work_package',id:'SAME_WP'},undefined,aiccProjection,aicc).type,'work_package');
assert.equal(resolveEntityContext(snapshot,{type:'work_package',id:'SAME_WP'},undefined,erpProjection,erp).type,'work_package');
assert.throws(()=>resolveEntityContext(snapshot,{type:'work_package',id:'SAME_WP'},undefined,aiccProjection,erp),/WP_PROJECT_SCOPE_MISMATCH/);
assert.throws(()=>resolveEntityContext(snapshot,{type:'work_package',id:'SAME_WP'},undefined,aiccProjection),/WP_PROJECT_SCOPE_REQUIRED/);
console.log('Phase 3 project-scoped WP entity context passed');
