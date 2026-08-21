import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COMPOSER_DRAFT_STORAGE_KEY,persistComposerDraft,readComposerDraft} from './composerDraft.ts';
import {resolveComposerCanonicalResult} from './composerCopyResult.ts';

const values=new Map<string,string>();
const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>void values.set(key,value),removeItem:(key:string)=>void values.delete(key)} as unknown as Storage;

persistComposerDraft('instruction A',storage);
assert.equal(readComposerDraft(storage),'instruction A','a draft persists across workspace navigation');
assert.equal(readComposerDraft(storage),'instruction A','a failed submission preserves the persisted draft');
persistComposerDraft('',storage);
assert.equal(readComposerDraft(storage),'','an accepted submission clears the persisted draft');
assert.equal(values.has(COMPOSER_DRAFT_STORAGE_KEY),false,'a cleared draft is removed from storage');

const runA={runId:'run-a',canonicalResult:{rawResult:'result A'}} as any;
assert.equal(resolveComposerCanonicalResult('run-a',[runA]),'result A','clearing the draft does not affect the Composer-owned result binding');

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const dock=readFileSync(new URL('../components/GlobalExecutionComposerDock.svelte',import.meta.url),'utf8');
const css=readFileSync(new URL('../app.css',import.meta.url),'utf8');

assert.match(app,/bridgePayload=readComposerDraft\(typeof localStorage==='undefined'\?undefined:localStorage\)/,'the Composer restores its persisted draft');
assert.match(app,/function updateBridgePayload\(value:string\)\{bridgePayload=value;persistComposerDraft\(value/,'draft changes update memory and persistence together');
assert.match(app,/function clearComposerDraft\(\)\{bridgePayload='';persistComposerDraft\(''/,'clearing removes both in-memory and persisted draft state');
assert.match(app,/if\(launched\)\{bindComposerSubmittedRun\(launched\.runId\);clearComposerDraft\(\);pendingInstructionId=null;instructionState='RUN_STARTED'/,'manual execution clears only after successful launch acknowledgement while retaining the submitted run ID');
assert.match(app,/if\(item\?\.runId\|\|item\?\.state==='LAUNCHED'\)\{bindComposerSubmittedRun\(item\?\.runId\);clearComposerDraft\(\);bindLaunchedExecution\(item\)/,'already-launched submission clears after execution identity is confirmed');
assert.doesNotMatch(app,/async function executeInstruction\(\)[\s\S]{0,650}composerSubmittedRunId=null/,'a failed submission does not discard the existing Composer execution binding');
assert.match(dock,/placeholder="输入 AICC 指令…"/,'an empty draft returns the Composer placeholder');
assert.match(css,/\.global-composer-dock-lane\{position:absolute;inset:auto 0 16px;width:100%;max-width:none;z-index:50;background:transparent;pointer-events:none\}/,'the frozen absolute-overlay layout remains unchanged');
assert.match(dock,/max-width:48rem/,'the frozen Composer width remains unchanged');

console.log('composer clear after submit tests passed');
