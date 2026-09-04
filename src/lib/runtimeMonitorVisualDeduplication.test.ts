import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const monitor=readFileSync(new URL('../components/RuntimeMonitor.svelte',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../components/entity/RuntimeWorkspace.svelte',import.meta.url),'utf8');
const css=readFileSync(new URL('../app.css',import.meta.url),'utf8');

assert.match(workspace,/<section class="runtime-live-section" data-testid="runtime-live-activity">\s*<div class="section-label">/,'outer Runtime Live Activity header remains present');
assert.doesNotMatch(monitor,/<div class="section-label">/,'RuntimeMonitor has no duplicate inner header');
assert.doesNotMatch(css,/(?:^|})\.runtime-monitor\{[^}]*\}/,'RuntimeMonitor has no nested card styling rule');
for(const marker of ['runtime-summary','runtime-health','runtime-metrics','runtime-events','runtime-acceptance','runtime-technical','runtime-result-panel'])assert.match(monitor,new RegExp(`class="${marker}"`),`${marker} remains present`);
assert.match(monitor,/data-runtime-status=\{model\.status\}/,'runtime status projection remains unchanged');
console.log('runtime monitor visual deduplication tests passed');
