import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../components/entity/RuntimeWorkspace.svelte',import.meta.url),'utf8');
const bridge=readFileSync(new URL('./bridgeCore.ts',import.meta.url),'utf8');

const topActionBar=workspace.match(/runtime-top-action-bar[\s\S]*?<\/div><\/div>/)?.[0]??'';
assert.equal((topActionBar.match(/<button class="service-action"/g)??[]).length,4,'runtime top action bar has no redundant manual execution button');
assert(workspace.includes('onPasteInstruction'),'paste action is wired to App');
assert(workspace.includes('onImportInstruction'),'explicit import action is wired to App');
assert(workspace.includes('instructionState'),'runtime instruction state is visible');
assert(app.includes('async function pasteInstruction()'),'paste handler exists');
const pasteHandler=app.match(/async function pasteInstruction\(\)[\s\S]*?\n  async function importInstruction/)?.[0]??'';
assert(!pasteHandler.includes('importBridge'),'paste does not invoke import');
assert(app.includes('async function importInstruction()'),'explicit import handler exists');
assert(app.includes('const item=await importBridge(bridgePayload)'),'import action invokes the canonical import path');
assert(!app.includes("instructionState='IMPORTED_PENDING'"),'explicit import does not leave a manual execution gate');
assert(!app.includes("if(autoExecute)return"),'Auto Execute does not gate explicit submission');
assert(app.includes('EMPTY_CLIPBOARD'),'empty clipboard has an actionable error');
assert(app.includes('updateBridgePayload(text)'),'clipboard text populates the textarea before import');
assert(app.includes("instructionState='TEXT_READY'"),'paste exposes text-ready state');
assert(app.includes("instructionState='RUN_STARTED'"),'execution exposes run-started state');
assert(!bridge.includes('if(readAutoExecute())'),'Auto Execute setting does not gate explicit bridge dispatch');
assert(!app.includes('setInterval(()=>void pasteInstruction'),'polling does not re-import pasted content');
console.log('paste/import runtime matrix passed');
