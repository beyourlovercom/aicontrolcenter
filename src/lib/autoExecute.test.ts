import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {join} from 'node:path';

const root=process.cwd();
const bridge=readFileSync(join(root,'src/lib/bridgeCore.ts'),'utf8');
const app=readFileSync(join(root,'src/App.svelte'),'utf8');
const vite=readFileSync(join(root,'vite.config.ts'),'utf8');

assert.doesNotMatch(bridge,/autoExecuteFile|readAutoExecute|writeAutoExecute/);
assert.doesNotMatch(app,/auto-execute-toggle|自动执行/);
assert.doesNotMatch(vite,/api\/settings\/auto-execute|writeAutoExecute/);
assert.match(bridge,/return launchInboxItem\(item\.id,metadata\)/,'canonical submission still launches through the typed Inbox path');
assert.doesNotMatch(bridge,/AUTO_EXECUTE_RETRY/);
assert.doesNotMatch(app,/待执行状态|等待 Auto Execute/);
console.log('legacy Auto Execute removal matrix passed');
