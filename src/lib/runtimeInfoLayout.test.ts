import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const monitor=readFileSync(new URL('../components/RuntimeMonitor.svelte',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../components/entity/RuntimeWorkspace.svelte',import.meta.url),'utf8');
const css=readFileSync(new URL('../app.css',import.meta.url),'utf8');
for(const source of [monitor,workspace]){assert.match(source,/aicc-info-list/);assert.match(source,/aicc-info-row/);assert.match(source,/aicc-info-label/);assert.match(source,/aicc-info-value/)}
assert.match(css,/\.aicc-info-row\{display:grid;grid-template-columns:max-content minmax\(0,1fr\)/);
assert.match(css,/\.aicc-info-value\{[^}]*text-align:right/);
assert.match(css,/runtime-current-card \.runtime-current-grid[^}]*display:none/);
assert.match(css,/runtime-current-card \.runtime-run-times[^}]*display:none/);
assert.doesNotMatch(workspace,/runtime-current-grid">[\s\S]*<div><small>/,'current execution no longer renders stacked tile fields');
assert.doesNotMatch(workspace,/runtime-evidence-grid">[\s\S]*<div><dt>/,'execution evidence no longer renders grid fields');
console.log('runtime unified horizontal info layout contract passed');
