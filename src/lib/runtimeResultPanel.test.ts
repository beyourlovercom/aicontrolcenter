import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../components/entity/RuntimeWorkspace.svelte',import.meta.url),'utf8');
const monitor=readFileSync(new URL('../components/RuntimeMonitor.svelte',import.meta.url),'utf8');
const actionLayer=readFileSync(new URL('./executionActionLayer.ts',import.meta.url),'utf8');

assert.match(monitor,/runtime-result-panel/,'Runtime Result panel is inside Runtime Monitor');
assert.match(monitor,/技术详情[\s\S]*运行结果/,'Runtime Result follows technical details');
assert.match(monitor,/resultText/,'panel consumes a resolved result');
assert.match(monitor,/等待 Codex 结果…/,'missing-result state is truthful and never projects empty success');
assert.match(monitor,/runtime-result-copy/,'copy control is compact and visible');
assert.match(workspace,/focused&&focusedTask\?canonicalTaskResultForRun\(focusedTask,focused\.runId\)\?\.rawResult/,'exact selected Run binding resolves the Project Task Registry Result source');
assert.match(workspace,/onCopyResult\(runId\)/,'copy delegates to the canonical action');
assert.equal((workspace.match(/runtime-result-detail/g)??[]).length,0,'no second inline historical result implementation');
assert.doesNotMatch(workspace,/runtime-history-card|runtime-run-actions/,'historical Run browsing does not duplicate Result detail');
assert.match(app,/copyResult:canonicalCopyResult/,'App binds the canonical action layer copy result');
assert.match(actionLayer,/matchesMacShortcut\(event, 'c'\).*layer\.copyResult/,'Option+Command+C uses canonical copy result');
console.log('runtime result panel matrix passed');
