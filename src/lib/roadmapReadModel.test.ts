import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {deserializeRoadmapReadModel,ensureRoadmapReadModel,ROADMAP_CANONICAL_SOURCE,ROADMAP_READ_MODEL} from './roadmapReadModel.ts';

const temporary=mkdtempSync(join(tmpdir(),'aicc-roadmap-read-model-'));
const sourcePath=join(temporary,'01_LIVING_ROADMAP.md'),readModelPath=join(temporary,'02_AICC_ROADMAP_READ_MODEL.json');
const source=(revision:number,extra='')=>`# Roadmap\n\nRoadmap-Revision: ${revision}\n\n## Current milestone\n\n\`M8 — Lifecycle\`\n\nCurrent Work Package: \`AICC_GLOBAL_CANONICAL_LIFECYCLE_PROJECTION_V1\`\n\nCurrent implementation phase: \`Phase 1 — Build\`\n\n## Active V2 Milestones\n\n### M8 — Lifecycle\nWork Packages: \`AICC_GLOBAL_CANONICAL_LIFECYCLE_PROJECTION_V1\`, \`AICC_EXACT_RUN_TERMINAL_STATE_PROPAGATION_REGRESSION_V1\`, \`AICC_BRIDGE_RESULT_AUTO_RETURN_REGRESSION_V1\`, \`AICC_AUTO_LOOP_FEEDBACK_DELIVERY_AND_TURN_CORRELATION_V1\`, \`WP-WORK-PACKAGE-Homepage-001\`, \`AICC_REPOSITORY_STALE_TEST_DEBT_CLEANUP_V1\`\n${extra}\n## Legacy Historical Milestones\n`;

try{
  writeFileSync(sourcePath,source(4));
  const first=ensureRoadmapReadModel({sourcePath,readModelPath,generatedAt:'2026-08-20T00:00:00.000Z'});
  assert.equal(first.schema,'AICC_ROADMAP_READ_MODEL_V1');assert.equal(first.read_only,true);assert.equal(first.source,ROADMAP_CANONICAL_SOURCE);assert.equal(first.source_revision,4);assert.equal(first.projection_revision,1);assert.ok(first.source_hash);assert.equal(deserializeRoadmapReadModel(JSON.parse(readFileSync(readModelPath,'utf8')))?.projection_revision,1,'missing read model auto-builds at the canonical generated location');
  const ids=first.milestones.flatMap(item=>item.children.map(child=>child.id));
  for(const id of ['AICC_GLOBAL_CANONICAL_LIFECYCLE_PROJECTION_V1','AICC_EXACT_RUN_TERMINAL_STATE_PROPAGATION_REGRESSION_V1','AICC_BRIDGE_RESULT_AUTO_RETURN_REGRESSION_V1','AICC_AUTO_LOOP_FEEDBACK_DELIVERY_AND_TURN_CORRELATION_V1','WP-WORK-PACKAGE-Homepage-001','AICC_REPOSITORY_STALE_TEST_DEBT_CLEANUP_V1'])assert.ok(ids.includes(id),`${id} is discovered from canonical hierarchy without a prefix allowlist`);
  assert.equal(ensureRoadmapReadModel({sourcePath,readModelPath}).projection_revision,1,'unchanged source reuses the current read model');
  assert.equal(ensureRoadmapReadModel({sourcePath,readModelPath,forceRebuild:true}).projection_revision,2,'explicit refresh advances projection revision');
  writeFileSync(sourcePath,source(5,'Status: `PLANNED`'));
  const changed=ensureRoadmapReadModel({sourcePath,readModelPath});assert.equal(changed.source_revision,5);assert.equal(changed.projection_revision,3,'source hash change rebuilds and advances projection revision');
  assert.equal(readdirSync(temporary).some(name=>name.endsWith('.tmp')),false,'atomic rename leaves no partial read model');
  const preserved=readFileSync(readModelPath,'utf8');writeFileSync(sourcePath,'Roadmap-Revision: 6\ninvalid source');assert.throws(()=>ensureRoadmapReadModel({sourcePath,readModelPath}),/ROADMAP_READ_MODEL_BUILD_FAILED/);assert.equal(readFileSync(readModelPath,'utf8'),preserved,'failed newer source build never replaces the forensic read model');
  assert.equal(ROADMAP_READ_MODEL,'docs/10_Planning_Roadmap/02_AICC_ROADMAP_READ_MODEL.json');
}finally{rmSync(temporary,{recursive:true,force:true})}

const controlService=readFileSync(new URL('./controlService.ts',import.meta.url),'utf8');
const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const vite=readFileSync(new URL('../../vite.config.ts',import.meta.url),'utf8');
const ignore=readFileSync(new URL('../../.gitignore',import.meta.url),'utf8');
assert.doesNotMatch(controlService,/join\(AICC_STATE_DIR,'roadmap-projection\.json'\)|readFileSync\([^\n]*roadmap-projection\.json/,'legacy home projection is never read');
assert.match(controlService,/ensureRoadmapReadModel\(\)/,'GET authority delegates to the single Layer 2 builder');
assert.match(controlService,/ensureRoadmapReadModel\(\{forceRebuild:true\}\)/,'refresh forces a rebuilt Layer 2 projection');
assert.match(vite,/\/api\/roadmap[\s\S]*readActiveProjectRoadmap/,'Roadmap API returns the active project Layer 2 projection');
assert.match(vite,/\/api\/roadmap[\s\S]*projectContextRevision/,'Roadmap API exposes the active project context revision');
assert.doesNotMatch(app,/ROADMAP_CACHE_KEY|readRoadmapCache|normalizeRoadmap|roadmapResult\.value\.content/,'production App has no Markdown parser or stale Roadmap browser-cache authority');
assert.match(app,/deserializeRoadmapProjection\(data\?\.projection\)/,'production App consumes Layer 2 directly');
assert.match(ignore,/^docs\/10_Planning_Roadmap\/02_AICC_ROADMAP_READ_MODEL\.json$/m,'generated repository-local read model is ignored exactly');
console.log('Roadmap local read-model authority tests passed');
