import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const read = (path) => readFile(join(root, path), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const legacy = await read('docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md');
const v4 = await read('docs/10_Planning_Roadmap/AICC-V4-LIVING-ROADMAP.md');
const v3 = await read('docs/10_Planning_Roadmap/AICC-V3-LIVING-ROADMAP.md');
const handoff = await read('docs/60_Operations/AICC-V3-FINAL-HANDOFF.md');
const wp = await read('docs/60_Operations/work-packages/AICC-V4-ROADMAP-REBASELINE-001.md');
const oneB = await read('docs/60_Operations/work-packages/AICC-CONTROL-LOOP-001B.md');

assert(legacy.includes('AICC-V4-LIVING-ROADMAP.md'), 'legacy roadmap points to canonical V4 roadmap');
assert(!legacy.includes('M4.1 is now the sole current development mainline'), 'legacy roadmap does not present M4.1 as current');
assert(legacy.includes('`CURRENT_M4_1_PHASE = HISTORICAL_SUPERSEDED`'), 'legacy current phase is historical');
for (const phase of ['## V4.0 — Roadmap Rebaseline','## V4.1 — OpenSpec Binding','## V4.2 — Review + Exact-head CI Control Plane','## V4.3 — Autonomous PR Delivery','## V4.4 — WP Automatic Lifecycle','## V4.5 — Evidence & Audit','## V4.6 — Mobile Owner Console','## V4.7 — Multi-project AICC','## V4.8 — Self-development Real Run']) assert(v4.includes(phase), `canonical V4 sequence includes ${phase}`);
for (const total of ['80–123h','23–37h','103–160h']) assert(v4.includes(total), `V4 budget includes ${total}`);
assert(v3.includes('CLOSED / PRODUCTION BASELINE SEALED'), 'V3 roadmap remains sealed');
assert(handoff.includes('AICC V3.0–V3.9 production baseline is therefore sealed'), 'V3 handoff closure remains present');
assert(wp.includes('status: AUTHORIZED') && wp.includes('owner_authorization: AUTHORIZED_FOR_IMPLEMENTATION'), 'V4.0 WP authorization is valid');
assert(wp.includes('openspec_change: aicc-v4-roadmap-rebaseline-001') && wp.includes('previous_run_status: PLANNED'), 'V4.0 WP schema fields are valid');
assert(wp.includes('RUNTIME_SOURCE_CHANGE') && wp.includes('OPENSPEC_APPLY'), 'V4.0 WP forbids runtime and OpenSpec execution');
assert(oneB.includes('status: PLANNED') && oneB.includes('owner_authorization: NOT_AUTHORIZED'), '001B remains planned and unauthorized');
console.log('roadmap documentation regression tests passed');
