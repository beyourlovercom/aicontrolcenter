import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../components/entity/RuntimeWorkspace.svelte',import.meta.url),'utf8');
const bridge=readFileSync(new URL('./bridgeCore.ts',import.meta.url),'utf8');

const topActionBar=workspace.match(/runtime-top-action-bar[\s\S]*?<\/div><\/div>/)?.[0]??'';
assert.equal((topActionBar.match(/<button class="service-action"/g)??[]).length,4,'runtime top action bar has four Owner buttons');
assert(workspace.includes('onPasteInstruction'),'paste action is wired to App');
assert(!workspace.includes('导入指令'),'separate import button is removed');
assert(app.includes('async function pasteInstruction()'),'paste handler exists');
assert(app.includes('const item=await importBridge(text)'),'paste invokes the canonical import path');
assert(app.includes("code:'PASTE_IMPORT_PENDING'"),'Auto Execute OFF leaves a pending imported instruction');
assert(app.includes("if(autoExecute)return"),'manual execution remains disabled while Auto Execute is ON');
assert(app.includes('pendingInstructionId'),'manual execution reuses the imported instruction');
assert(app.includes('EMPTY_CLIPBOARD'),'empty clipboard has an actionable error');
assert(app.includes('bridgePayload=text'),'clipboard text populates the textarea before import');
assert(bridge.includes('if(readAutoExecute())'),'Auto Execute still uses the existing bridge import behavior');
assert(!app.includes('setInterval(()=>void pasteInstruction'),'polling does not re-import pasted content');
console.log('paste/import runtime matrix passed');
