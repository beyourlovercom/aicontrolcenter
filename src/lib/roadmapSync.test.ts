import assert from 'node:assert/strict';
import {resolveRoadmapSyncState} from './model/roadmapSync.ts';

const evidence=(phase:string,extra='')=>({content:`## Active V2 Milestones\n### M4 — Test\nWork Packages: \`AICC-V2-TEST-001\`\nPhase ${phase} / 6 · ${extra}`,phaseEvidence:{'AICC-V2-TEST-001':phase}});
assert.equal(resolveRoadmapSyncState(evidence('5'),evidence('4')).syncStatus,'LOCAL_AHEAD');
assert.equal(resolveRoadmapSyncState(evidence('4'),evidence('5')).syncStatus,'GITHUB_AHEAD');
assert.equal(resolveRoadmapSyncState(evidence('5'),evidence('5')).syncStatus,'SYNCED');
assert.equal(resolveRoadmapSyncState(evidence('5','Local'),evidence('5','GitHub')).syncStatus,'DIVERGED');
assert.equal(resolveRoadmapSyncState({...evidence('4'),content:evidence('4').content+'\nCSS changed'},evidence('4')).syncStatus,'SYNCED');
assert.equal(resolveRoadmapSyncState(evidence('5'),null).currentProgressSource,'Local + GitHub');
console.log('roadmap sync tests passed');
