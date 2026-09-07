import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const read = (path) => readFile(join(root, path), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const legacy = await read('docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md');
const v4 = await read('docs/10_Planning_Roadmap/AICC-V4-LIVING-ROADMAP.md');
const v3 = await read('docs/10_Planning_Roadmap/AICC-V3-LIVING-ROADMAP.md');
const wp = await read('docs/60_Operations/work-packages/AICC-V4-ROADMAP-REBASELINE-001.md');

assert(legacy.includes('AICC-V4-LIVING-ROADMAP.md'), 'legacy roadmap points to canonical V4 roadmap');
assert(!legacy.includes('M4.1 is now the sole current development mainline'), 'legacy roadmap does not present M4.1 as current');
for (const token of ['GITHUB_SOURCE_OF_TRUTH = 1','GPT_ORCHESTRATION_AUTHORITY = 1','AICC_EXECUTION_AUTHORITY = 0','AICC_DECISION_AUTHORITY = 0']) assert(v4.includes(token), `V4 architecture contains ${token}`);
for (const phase of ['V4.1 — Project Registry + GitHub Project Facts','V4.2 — Project Switcher + All Projects Dashboard','V4.3 — Development Tree + Detail View','V4.4 — Progress + Drift / Stale Detection','V4.5 — Owner Attention Center','V4.6 — Three-machine Runtime Overview','V4.7 — GPT Context Snapshot + Suggested Next','V4.8 — Multi-project Real-use Hardening']) assert(v4.includes(phase), `V4 sequence contains ${phase}`);
assert(v4.includes('Total V4 budget: `31–52h`'), 'V4 budget total is present');
assert(v4.includes('Top-right: `Project Switcher`') && v4.includes('Left: collapsible `Development Tree`'), 'accepted UI baseline is recorded');
assert(v3.includes('CLOSED / PRODUCTION BASELINE SEALED'), 'V3 roadmap remains sealed');
assert(wp.includes('Source of Truth: `GitHub`'), 'V4.0 WP records GitHub-first authority');
assert(v4.includes('Current Work Package: `AICC-V4-PRODUCTION-UAT-GITHUB-LATENCY-HOTFIX-001`'), 'Production UAT hotfix is the current Work Package');
assert(v4.includes('Status: `V4 CODE CLOSED / PRODUCTION UAT ACTIVE`'), 'V4 code closure and production UAT status are current');
console.log('roadmap documentation regression tests passed');
