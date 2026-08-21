import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../app.css',import.meta.url),'utf8');
assert.match(css,/\.current-context\{[^}]*min-width:0/);assert.match(css,/\.current-context-actions\{[^}]*flex:0 0 auto/);assert.match(css,/\.current-context-copy\{[^}]*overflow:hidden/);assert.match(css,/\.current-context-copy strong,\.current-context-copy small\{[^}]*white-space:nowrap/);assert.match(css,/text-overflow:ellipsis/);assert.match(css,/\.current-context\.locked \.current-context-copy strong[^}]*color:#159447/);
console.log('current context overflow matrix passed');
