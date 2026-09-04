import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const panel=readFileSync(new URL('../components/entity/ExecutionProviderPanel.svelte',import.meta.url),'utf8');

assert.match(app,/header-execution-selector/,'header selector is in the existing header controls');
assert.match(app,/option value="REMOTE_CLAUDE">US-Claude/,'US-Claude is an exact visible option');
assert.match(app,/option value="LOCAL_CODEX">CN-Codex/,'CN-Codex is an exact visible option');
assert.match(app,/aicc-selected-execution-provider/,'header selection uses the canonical persisted key');
assert.match(app,/value=\{executionProvider\}[\s\S]*setExecutionProvider/,'header selection updates canonical state');
assert.match(app,/const currentProvider=readExecutionProvider\(\)/,'Composer reads the header selection at submit time');
assert.match(app,/runnerId:launchMetadata\?\.runnerId\?\?\(currentProvider==='REMOTE_CLAUDE'\?'US-WAREHOUSE-01':undefined\)/,'remote runner identity is canonicalized at submission');
assert.match(panel,/export let editable=false/,'lower provider panel is read-only by default');
assert.match(panel,/:else\}<b class="provider-value">\{providerId==='REMOTE_CLAUDE'\?'US-Claude':'CN-Codex'\}/,'lower panel projects the same selection without another selector');
console.log('header execution provider selector contract passed');
