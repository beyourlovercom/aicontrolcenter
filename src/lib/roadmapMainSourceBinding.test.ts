import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { normalizeRoadmap } from './model/projectModel.ts';
import { readLocalRoadmap, readRoadmap, roadmapProjectionPath, roadmapSourcePath, readWorkPackages } from './controlService.ts';
import { ensureRoadmapReadModel } from './roadmapReadModel.ts';

const repository = '/Users/a/AI/007/AIcontrolcenter';
const activeBranch = execFileSync('git', ['branch', '--show-current'], { cwd: repository, encoding: 'utf8' }).trim();
assert.notEqual(activeBranch, 'main', 'the active development worktree remains independent from main');
const localRoadmap = readLocalRoadmap();
assert.equal(readRoadmap(), localRoadmap, 'local roadmap remains a first-class source');
assert.equal(roadmapSourcePath(), 'docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md');
const readModel=ensureRoadmapReadModel();
assert.equal(readModel.source,'docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md');
assert.equal(roadmapProjectionPath(),'/Users/a/AI/007/AIcontrolcenter/docs/10_Planning_Roadmap/02_AICC_ROADMAP_READ_MODEL.json');

const dynamic = normalizeRoadmap('## Active V2 Milestones\n### M99 — Future Milestone\nWork Packages: `AICC-M99-FUTURE-001`\n## Legacy Historical Milestones\n');
assert.equal(dynamic[0]?.id, 'M99', 'future milestones remain parser-driven');
assert.equal(dynamic[0]?.children[0]?.id, 'AICC-M99-FUTURE-001');
assert.ok(readWorkPackages().every(item => item.source.startsWith('docs/')),
  'roadmap-referenced formal WPs resolve from a canonical docs source');
assert.equal(activeBranch, execFileSync('git', ['branch', '--show-current'], { cwd: repository, encoding: 'utf8' }).trim(), 'refresh does not switch branches');
console.log('roadmap main source binding tests passed');
