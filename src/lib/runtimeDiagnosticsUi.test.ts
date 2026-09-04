import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workspace=readFileSync(new URL('../components/entity/RuntimeWorkspace.svelte',import.meta.url),'utf8');
const detail=readFileSync(new URL('../components/GlobalTaskDetail.svelte',import.meta.url),'utf8');
const diagnostics=readFileSync(new URL('../components/RuntimeDiagnostics.svelte',import.meta.url),'utf8');
assert.ok(workspace.indexOf('<RuntimeDiagnostics diagnostic={diagnostic}/>')<workspace.indexOf('runtime-current-execution'),'center diagnostics is directly above current runtime card');
assert.ok(detail.indexOf('<RuntimeDiagnostics diagnostic={diagnostic} compact/>')<detail.indexOf('<section class="detail-section">'),'right diagnostics precedes detail sections');
assert.match(workspace,/buildRuntimeDiagnostic/);
assert.match(detail,/buildRuntimeDiagnostic/);
assert.match(diagnostics,/failed|stderr|processExit|diagnosticOrigin/);
assert.match(diagnostics,/复制完整 stderr/);
console.log('runtime diagnostics UI contract passed');
