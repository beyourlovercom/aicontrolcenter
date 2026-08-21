import assert from 'node:assert/strict';
import {createEmptyGlobalStateReadModel} from './globalStateReadModel.ts';
import {createProjectSnapshot} from './model/projectModel.ts';
import {scopedEntityKey} from './projectEntityScope.ts';
import {projectWpLayer2} from './wpCanonicalProjection.ts';

const aicc={projectId:'aicc',repositoryIdentity:'beyourlovercom/aicontrolcenter',projectContextRevision:0};
const erp={projectId:'erpbeyourlovercom',repositoryIdentity:'beyourlovercom/erpbeyourlovercom',projectContextRevision:1};
const snapshot=createProjectSnapshot({roadmap:{source:'fixture',content:'## Active V2 Milestones\n### M1 — Fixture\nWork Packages: `SAME_WP`\n`SAME_WP` — `PLANNED`; Fixture.'},formalWorkPackages:{}});
const aiccProjection=projectWpLayer2(createEmptyGlobalStateReadModel(aicc),snapshot,[],aicc);
const erpProjection=projectWpLayer2(createEmptyGlobalStateReadModel(erp),snapshot,[],erp);
const aiccWp=aiccProjection.records[0]!,erpWp=erpProjection.records[0]!;
assert.notEqual(aiccWp.identityKey,erpWp.identityKey);
assert.equal(aiccWp.identityKey,scopedEntityKey(aicc,'WORK_PACKAGE','SAME_WP'));
assert.equal(erpWp.identityKey,scopedEntityKey(erp,'WORK_PACKAGE','SAME_WP'));
assert.equal(aiccProjection.records.filter(record=>record.identityKey===scopedEntityKey(aicc,'WORK_PACKAGE','SAME_WP')).length,1);
assert.equal(erpProjection.records.filter(record=>record.identityKey===scopedEntityKey(erp,'WORK_PACKAGE','SAME_WP')).length,1);
assert.throws(()=>projectWpLayer2(createEmptyGlobalStateReadModel(aicc),snapshot,[],undefined as never),/WP_PROJECT_SCOPE_REQUIRED/);
console.log('Phase 3 WP canonical project-scope boundary passed');
