import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const css=readFileSync(new URL('../app.css',import.meta.url),'utf8');
const dock=readFileSync(new URL('../components/GlobalExecutionComposerDock.svelte',import.meta.url),'utf8');

const viewportMarker='data-testid="center-workspace-scroll-viewport"';
const laneMarker='data-testid="global-composer-dock-lane"';
const viewportStart=app.indexOf(viewportMarker);
const laneStart=app.indexOf(laneMarker);
const composerStart=app.indexOf('<GlobalExecutionComposerDock');

assert.ok(viewportStart>=0,'the center workspace has an explicit scroll viewport');
assert.ok(laneStart>viewportStart,'the overlay lane is a sibling after the scroll viewport');
assert.ok(composerStart>laneStart,'the singleton composer is a child of the dock lane');
assert.match(app.slice(viewportStart,laneStart),/<div class="composer-overlay-tail-spacer" data-testid="composer-overlay-tail-spacer"/,'the content reserves only an end-of-content overlay tail');
assert.equal((app.match(/<GlobalExecutionComposerDock/g)??[]).length,1,'Blueprint, WP, PR, and Task share one persistent composer');
assert.match(css,/\.center-workspace-shell\{position:relative;height:100%;min-height:0;max-height:100%;overflow:hidden\}/,'the App shell is the relative containing block for the overlay');
assert.match(css,/\.workspace\{height:calc\(100dvh - 72px\);min-height:0;grid-template-rows:minmax\(0,1fr\)\}/,'the workspace bounds its grid row to the visible application row');
assert.match(css,/\.center-workspace-scroll\{height:100%;min-height:0;overflow-x:hidden;overflow-y:auto\}/,'the center viewport remains the only center vertical scroll authority');
assert.match(css,/\.global-composer-dock-lane\{position:absolute;inset:auto 0 16px;width:100%;max-width:none;z-index:50;background:transparent;pointer-events:none\}/,'the lane is a transparent full-width absolute overlay at 16px');
assert.match(dock,/\.global-composer-shell\{display:flex;width:100%;min-width:0;max-width:none;align-items:flex-end;justify-content:center;[^}]*background:transparent;pointer-events:none\}/,'the transparent Composer shell fills the lane without blocking surrounding content');
assert.match(dock,/\.global-composer-width-container\{width:100%;min-width:0;max-width:48rem;margin-inline:auto;box-sizing:border-box;pointer-events:auto\}/,'the interaction container is responsive and capped at 48rem');
assert.match(dock,/\.global-execution-composer\{display:grid;width:100%;min-width:0;max-width:none;box-sizing:border-box;[^}]*pointer-events:auto\}/,'the Composer surface fills its width container');
assert.match(app,/onHeightChange=\{updateComposerHeight\}/,'the only measured height authority drives the tail reserve');
assert.match(css,/\.composer-overlay-tail-spacer\{height:calc\(var\(--aicc-composer-overlay-height\) \+ 16px\);pointer-events:none\}/,'the tail reserve keeps final content reachable without layout-wide padding');
assert.doesNotMatch(app+css,/composer-bottom-spacer|aicc-composer-safe-area|scroll-padding-bottom|grid-template-rows:minmax\(0,1fr\) auto/,'no obsolete dock-row or overlay compensation remains');
assert.match(dock,/min-height:52px/,'idle Composer preserves its compact height');
assert.match(dock,/grid-template-areas:"primary primary primary" "leading footer trailing"/,'multiline expansion preserves its stable footer layout');
assert.match(dock,/data-tooltip="更多操作"[\s\S]*data-tooltip="粘贴指令"[\s\S]*data-tooltip="导入指令"/,'Composer tooltips remain available');
assert.match(dock,/onPaste\(\)/,'paste callback remains available');
assert.match(dock,/onImport\(\)/,'import callback remains available');
assert.match(dock,/onExecute\(\)/,'execute callback remains available');

console.log('composer dedicated dock lane tests passed');
