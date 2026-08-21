import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('./controlService.ts',import.meta.url),'utf8');
const syncStart=source.indexOf('export function syncRoadmapProjection');
const syncBody=source.slice(syncStart,source.indexOf('\nexport function readFormalWorkPackageRegistry',syncStart));

assert.match(source,/const ROADMAP_GITHUB_REF = 'refs\/remotes\/origin\/rebuild\/aicc-v2';/);
assert.match(source,/const ROADMAP_GITHUB_BRANCH = 'rebuild\/aicc-v2';/);
assert.match(source,/git', \['fetch', '--no-tags', 'origin', `refs\/heads\/\$\{ROADMAP_GITHUB_BRANCH\}:refs\/remotes\/origin\/\$\{ROADMAP_GITHUB_BRANCH\}`/);
assert.match(source,/throw new Error\('GITHUB_ROADMAP_FETCH_FAILED'\)/);
assert.match(syncBody,/ensureRoadmapReadModel\(\{forceRebuild:true\}\)/,'manual refresh rebuilds from the local canonical source');
assert.doesNotMatch(syncBody,/refreshRoadmapGithubRef|readGithubRoadmap/,'GitHub selection is not part of production Roadmap refresh authority');
assert.doesNotMatch(source,/syncRoadmapProjection\([\s\S]{0,500}git', \['checkout|syncRoadmapProjection\([\s\S]{0,500}git', \['merge|syncRoadmapProjection\([\s\S]{0,500}git', \['reset/);
console.log('local canonical Roadmap refresh authority tests passed');
