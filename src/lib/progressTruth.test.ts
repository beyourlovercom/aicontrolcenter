import assert from 'node:assert/strict';
import {resolveProgressTruthState} from './model/progressTruth.ts';
import type {RoadmapSyncState,WorkPackagePhaseProgress} from './model/entityTypes.ts';

const plan=(phase:number):WorkPackagePhaseProgress=>({workPackageId:'WP',milestoneId:'M4',totalPhases:6,completedCount:phase-1,currentPhaseNumber:phase,currentPhaseTitle:`P${phase}`,phases:Array.from({length:6},(_,i)=>({number:i+1,title:`P${i+1}`,status:i+1<phase?'COMPLETE':i+1===phase?'ACTIVE':'PENDING'}))});
const sync=(status:'SYNCED'|'LOCAL_AHEAD'|'GITHUB_AHEAD'='SYNCED'):RoadmapSyncState=>({localEvidence:{content:'local'},githubEvidence:{content:'github'},syncStatus:status,currentProgressSource:status==='GITHUB_AHEAD'?'GitHub':'Local + GitHub',updatedAt:'2026-01-01T00:00:00Z'});
const runtime=(text:string,at='2026-01-02T00:00:00Z')=>({workPackageId:'WP',lastActivityAt:at,completedAt:at,finalAgentMessage:text} as any);

let state=resolveProgressTruthState({entityId:'WP',workPackageId:'WP',roadmap:plan(2),runtime:runtime('PHASE_5_STATUS = ACTIVE'),roadmapSync:sync()});
assert.equal(state.currentPhaseNumber,5); assert.equal(state.roadmapMetadataStale,true); assert.equal(state.syncStatus,'SYNCED');
state=resolveProgressTruthState({entityId:'WP',workPackageId:'WP',roadmap:plan(5),runtime:runtime('PHASE_5_STATUS = ACTIVE'),roadmapSync:sync()});
assert.equal(state.roadmapMetadataStale,false);
state=resolveProgressTruthState({entityId:'WP',workPackageId:'WP',roadmap:plan(2),runtime:runtime('TEST = PASS\nBUILD = PASS\nEXIT_CODE = 0'),roadmapSync:sync()});
assert.equal(state.currentPhaseNumber,2); assert.equal(state.progressEvidenceType,'ROADMAP');
state=resolveProgressTruthState({entityId:'WP',workPackageId:'WP',roadmap:plan(4),runtime:runtime('CURRENT_PHASE = 5'),roadmapSync:sync('LOCAL_AHEAD')});
assert.equal(state.currentPhaseNumber,5); assert.equal(state.syncStatus,'LOCAL_AHEAD');
state=resolveProgressTruthState({entityId:'WP',workPackageId:'WP',roadmap:plan(2),runtime:runtime('CURRENT_PHASE = 3','2026-01-01T00:00:00Z'),codexResult:{rawResult:'CURRENT_PHASE = 5',receivedAt:'2026-01-03T00:00:00Z'} as any,roadmapSync:sync()});
assert.equal(state.currentPhaseNumber,5); assert.equal(state.progressEvidenceType,'CODEX_RESULT');
console.log('progress truth tests passed');
