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
assert.equal(aiccWp.identityKey,'SAME_WP','canonical WP record identity remains the Roadmap WP ID');
assert.equal(erpWp.identityKey,'SAME_WP','the same canonical WP ID may exist in another Project');
assert.notEqual(scopedEntityKey(aicc,'WORK_PACKAGE',aiccWp.id),scopedEntityKey(erp,'WORK_PACKAGE',erpWp.id),'Layer 2 entity identity remains Project scoped');
assert.equal(aiccProjection.model.entities.filter(entity=>entity.identity.kind==='WORK_PACKAGE'&&entity.identity.id==='SAME_WP').length,1);
assert.equal(erpProjection.model.entities.filter(entity=>entity.identity.kind==='WORK_PACKAGE'&&entity.identity.id==='SAME_WP').length,1);
assert.throws(()=>projectWpLayer2(createEmptyGlobalStateReadModel(aicc),snapshot,[],undefined as never),/WP_PROJECT_SCOPE_REQUIRED/);
console.log('Phase 3 WP canonical project-scope boundary passed');
