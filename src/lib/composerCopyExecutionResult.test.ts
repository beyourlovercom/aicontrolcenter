import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveComposerCanonicalResult} from './composerCopyResult.ts';
import {COMPOSER_RUN_BINDING_STORAGE_KEY,persistComposerRunBinding,readComposerRunBinding} from './composerRunBinding.ts';

const composerRun=(runId:string,rawResult?:string)=>({runId,canonicalResult:rawResult?{rawResult}:undefined}) as any;
const runA=composerRun('run-a','canonical result A');
const unrelatedRunB=composerRun('run-b','unrelated result B');
const runC=composerRun('run-c');

assert.equal(resolveComposerCanonicalResult('run-a',[unrelatedRunB,runA]),'canonical result A','Composer result lookup uses the exact submitted run identity');
assert.equal(resolveComposerCanonicalResult('run-a',[unrelatedRunB]),null,'an unrelated completed result is never a fallback');
assert.equal(resolveComposerCanonicalResult('run-c',[runA,unrelatedRunB,runC]),null,'a new Composer run disables copying until its canonical result exists');
assert.equal(resolveComposerCanonicalResult('run-c',[runA,unrelatedRunB,composerRun('run-c','canonical result C')]),'canonical result C','the next Composer run replaces the previous copy target');
assert.equal(resolveComposerCanonicalResult(null,[runA,unrelatedRunB]),null,'no Composer submission has no copy target');
const storage=new Map<string,string>();
const localStorageLike={getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)} as unknown as Storage;
persistComposerRunBinding('run-a',localStorageLike);assert.equal(readComposerRunBinding(localStorageLike),'run-a','accepted Composer Run survives remount');assert.equal(storage.get(COMPOSER_RUN_BINDING_STORAGE_KEY),'run-a');
const pendingA=resolveComposerCanonicalResult('run-a',[composerRun('run-a'),unrelatedRunB]);assert.equal(pendingA,null,'accepted Run remains disabled until its own canonical result arrives');
const resolvedA=resolveComposerCanonicalResult('run-a',[composerRun('run-a','canonical result A'),unrelatedRunB]);assert.equal(resolvedA,'canonical result A','later canonical result enables the exact Composer Run');
assert.equal(resolveComposerCanonicalResult('run-c',[composerRun('run-a','canonical result A'),composerRun('run-b','canonical result B'),composerRun('run-c')]),null,'replacement Run disables copy despite prior results');

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const dock=readFileSync(new URL('../components/GlobalExecutionComposerDock.svelte',import.meta.url),'utf8');
const css=readFileSync(new URL('../app.css',import.meta.url),'utf8');

assert.match(dock,/data-tooltip="导入指令"[\s\S]*data-tooltip="复制运行结果"/,'copy action immediately follows Import');
assert.match(dock,/aria-label="复制运行结果"[\s\S]*>✅<\/button>/,'copy action has an accessible label and required icon');
assert.match(dock,/disabled=\{!copyResultAvailable\}/,'copy is unavailable before a canonical result exists');
assert.match(app,/composerSubmittedRunId=readComposerRunBinding/,'Composer restores its submitted run identity');
assert.match(app,/bindComposerSubmittedRun\(item\?\.runId\)/,'accepted automatic submission persists the Composer Run before clearing its draft');
assert.match(app,/bindComposerSubmittedRun\(launched\.runId\)/,'accepted manual submission persists the Composer Run before clearing its draft');
assert.match(app,/composerCopyResult=resolveComposerCanonicalResult\(composerSubmittedRunId,\[composerExactRuntime,\.\.\.runtimeHistory\]\.filter\(Boolean\)\)/,'copy availability is derived only from Composer identity and its exact canonical runtime');
assert.match(app,/async function refreshComposerCanonicalResult\(\)[\s\S]*\/api\/codex\/runtime\?runId=/,'live polling refreshes the Composer-owned Run directly');
assert.match(app,/async function copyComposerResult\(\)\{const result=resolveComposerCanonicalResult\(composerSubmittedRunId,\[composerExactRuntime,\.\.\.runtimeHistory\]\.filter\(Boolean\)\)/,'copy action has no selected/global result fallback');
assert.match(app,/await navigator\.clipboard\?\.writeText\(result\)/,'each copy action makes exactly one clipboard write');
assert.match(app,/copyResultAvailable=\{Boolean\(composerCopyResult\)\}[\s\S]*onCopyResult=\{copyComposerResult\}/,'dock receives only the Composer-scoped copy authority');
assert.doesNotMatch(app,/copyComposerResult\(\)[\s\S]{0,600}(?:displayRuntime|globalRuntime|selectedRunId)/,'Composer copy does not fall back to visible, global, or selected runtime state');
assert.match(css,/\.global-composer-dock-lane\{position:absolute;inset:auto 0 16px;width:100%;max-width:none;z-index:50;background:transparent;pointer-events:none\}/,'frozen absolute-overlay lane remains unchanged');
assert.match(dock,/max-width:48rem/,'frozen Composer width remains unchanged');

console.log('composer copy execution result tests passed');
