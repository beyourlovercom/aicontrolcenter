import assert from 'node:assert/strict';
import {canonicalRoadmapHash,compileRoadmapProjection,parseRoadmapRevision,preserveRoadmapUiState,selectRoadmapProjection} from './roadmapProjection.ts';

const body=(revision:number,extra='')=>`Roadmap-Revision: ${revision}\n## Active V2 Milestones\n### M1 — Test\nStatus: ACTIVE\nProgress: 10%\nWork Packages: \`AICC-WP-001\`\n${extra}`;
assert.equal(parseRoadmapRevision(body(4)),4);
assert.equal(parseRoadmapRevision(body(0)),null);
assert.equal(parseRoadmapRevision(body(4).replace('Roadmap-Revision: 4','Updated-At: now')),null);
assert.equal(canonicalRoadmapHash('a\r\nb'),canonicalRoadmapHash('a\nb'));
const local={source:'LOCAL' as const,content:body(4)};
const github={source:'GITHUB' as const,content:body(5)};
assert.equal(selectRoadmapProjection(local,github).projection?.revision,5);
assert.equal(selectRoadmapProjection(local,{...local,content:body(4,'different')}).status,'CONFLICT');
assert.equal(selectRoadmapProjection({...local,content:body(4)},null).status,'NO_VALID_REVISION');
const projection=compileRoadmapProjection(local);
assert.equal(preserveRoadmapUiState(projection,'M1','AICC-WP-001'),true);
assert.equal(preserveRoadmapUiState(projection,'MISSING',null),false);
console.log('roadmap projection tests passed');
