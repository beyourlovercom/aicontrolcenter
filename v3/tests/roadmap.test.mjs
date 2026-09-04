import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadCanonicalRoadmap,parseRoadmapMarkdown,ROADMAP_SOURCE} from '../lib/roadmap.mjs';

function markdown(current='V3.3 — Canonical Roadmap'){
  return `# AICC V3 Living Roadmap
Roadmap-Revision: 3
Updated-At: 2026-09-04
Status: \`ACTIVE\`

## Current milestone

\`${current}\`

Current Work Package: \`AICC-V3-CANONICAL-ROADMAP-001\`
Current implementation phase: \`V3.3.1 — read-only canonical roadmap projection\`

## Milestones

### V3.2 — Single Project Authority
Goal: one context.
Estimate: 5–6h.

### V3.3 — Canonical Roadmap
Goal: read-only canonical Roadmap.
Estimate: 4–5h.
`;
}
test('parser returns explicit canonical current state and milestones',()=>{
  const roadmap=parseRoadmapMarkdown(markdown());
  assert.equal(roadmap.revision,3);
  assert.equal(roadmap.current.milestone,'V3.3 — Canonical Roadmap');
  assert.equal(roadmap.current.workPackage,'AICC-V3-CANONICAL-ROADMAP-001');
  assert.equal(roadmap.current.phase,'V3.3.1 — read-only canonical roadmap projection');
  assert.deepEqual(roadmap.milestones.map(item=>item.title),[
    'V3.2 — Single Project Authority','V3.3 — Canonical Roadmap'
  ]);
});

test('invalid current milestone fails closed',()=>{
  assert.throws(()=>parseRoadmapMarkdown(markdown('V3.9 — Missing')),/ROADMAP_CURRENT_MILESTONE_NOT_LISTED/);
});

test('loader reads only from ProjectContext repository and is reload-safe',()=>{
  const root=mkdtempSync(join(tmpdir(),'aicc-v3-roadmap-'));
  const repo=join(root,'repo');
  mkdirSync(join(repo,'docs/10_Planning_Roadmap'),{recursive:true});
  const file=join(repo,ROADMAP_SOURCE);
  writeFileSync(file,markdown());
  const context={project:{id:'fixture'},repository:{path:repo,identity:'example/fixture',head:'abc123'}};
  const first=loadCanonicalRoadmap(context);
  assert.equal(first.authority.repositoryIdentity,'example/fixture');
  assert.equal(first.current.milestone,'V3.3 — Canonical Roadmap');
  const changed=markdown().replace('V3.3.1 — read-only canonical roadmap projection','V3.3.2 — refreshed projection');
  writeFileSync(file,changed);
  const second=loadCanonicalRoadmap(context);
  assert.equal(second.current.phase,'V3.3.2 — refreshed projection');
});

test('missing Roadmap source fails closed',()=>{
  const root=mkdtempSync(join(tmpdir(),'aicc-v3-roadmap-missing-'));
  const context={project:{id:'fixture'},repository:{path:root,identity:'example/fixture',head:'abc123'}};
  assert.throws(()=>loadCanonicalRoadmap(context),/ROADMAP_SOURCE_MISSING/);
});
