import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const inspector=readFileSync(new URL('../components/TaskRightContextInspector.svelte',import.meta.url),'utf8');
const detail=readFileSync(new URL('../components/GlobalTaskDetail.svelte',import.meta.url),'utf8');
const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const composer=readFileSync(new URL('../components/GlobalExecutionComposerDock.svelte',import.meta.url),'utf8');

assert.match(inspector,/\.task-context-inspector\{[^}]*width:100%;min-width:0;max-width:100%;[^}]*overflow:hidden/,'Task inspector root cannot exceed its rail');
assert.match(inspector,/\.task-context-inspector>\*\{min-width:0;max-width:100%;box-sizing:border-box\}/,'Task inspector children can shrink inside the rail');
assert.match(inspector,/\.task-inspector-scroll\{min-width:0;max-width:100%;overflow-x:hidden;overflow-y:auto/,'Task inspector retains vertical scrolling without horizontal breakout');
assert.match(detail,/\.global-task-detail\{[^}]*width:100%;min-width:0;max-width:100%;[^}]*overflow:hidden/,'nested Task detail is bounded by the inspector');
assert.match(detail,/\.detail-grid div\{display:grid;gap:2px;min-width:0;max-width:100%\}/,'metadata rows allow their value region to shrink');
assert.match(detail,/\.detail-grid b\{min-width:0;max-width:100%;overflow:hidden;[^}]*text-overflow:ellipsis;white-space:nowrap\}/,'long metadata values ellipsize while labels remain intact');
assert.match(detail,/\.detail-section pre\{min-width:0;max-width:100%;[^}]*overflow-x:hidden;overflow-y:auto;[^}]*overflow-wrap:anywhere;word-break:break-word/,'multi-line instruction and canonical result blocks stay within the panel');
assert.match(detail,/\.detail-section p\{min-width:0;max-width:100%;[^}]*overflow-wrap:anywhere;word-break:break-word/,'Evidence and prose wrap internally');
assert.match(detail,/\.detail-heading>div\{display:flex;flex:0 0 auto;gap:5px\}/,'result actions retain a non-shrinking in-boundary action region');
assert.match(detail,/navigator\.clipboard\?\.writeText\(result\.rawResult\)/,'copy actions use the full canonical result, never rendered ellipsis text');
assert.match(app,/TaskRightContextInspector task=\{selectedTask\}/,'Task selection wiring remains unchanged');
assert.match(app,/GlobalExecutionComposerDock payload=\{bridgePayload\}/,'Global Composer remains unchanged');

console.log('Task right evidence overflow tests passed');
