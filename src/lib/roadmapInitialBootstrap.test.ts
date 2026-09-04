import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseRoadmapRevision} from './roadmapProjection.ts';

const roadmap=readFileSync(new URL('../../docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md',import.meta.url),'utf8');
assert.ok((parseRoadmapRevision(roadmap)??0)>0,'local canonical source revision is audited without fabrication');
const controlService=readFileSync(new URL('./controlService.ts',import.meta.url),'utf8');
assert.match(controlService,/bootstrapInitialRoadmapProjection/);
assert.match(controlService,/ensureRoadmapReadModel\(\)/);
const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
assert.doesNotMatch(app,/ROADMAP_CACHE_KEY/,'startup cannot use a stale browser Roadmap projection');
assert.doesNotMatch(app,/readGithubRoadmap|readGithubRoadmapAsync/,'browser startup does not read GitHub truth');
const vite=readFileSync(new URL('../../vite.config.ts',import.meta.url),'utf8');
assert.match(vite,/readActiveProjectRoadmap/,'GET ensures and serves the active project Layer 2 projection');
console.log('Roadmap initial accepted snapshot bootstrap contract passed');
