import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const root=process.cwd();
const bridge=readFileSync(join(root,'src/lib/bridgeCore.ts'),'utf8');
const app=readFileSync(join(root,'src/App.svelte'),'utf8');
const vite=readFileSync(join(root,'vite.config.ts'),'utf8');

if(!bridge.includes('autoExecuteFile')||!bridge.includes('readAutoExecute')||!bridge.includes('writeAutoExecute'))throw new Error('Auto Execute preference persistence is missing');
if(!bridge.includes("enabled:false")||!bridge.includes('if(readAutoExecute())'))throw new Error('Auto Execute default/off path is missing');
if(!bridge.includes('return launchInboxItem(item.id)'))throw new Error('Auto Execute does not reuse the canonical launch path');
if(!bridge.includes('const existing=read<InboxItem[]>(inboxFile,[]).find(x=>x.id===item.id);if(existing)return existing'))throw new Error('Auto Execute receipt is not idempotent by instruction identity');
if((bridge.match(/if\(readAutoExecute\(\)\)/g)||[]).length!==1)throw new Error('Auto Execute launch path is not exactly once at receipt');
if(!app.includes('data-testid="auto-execute-toggle"')||!app.includes('自动执行：{autoExecute?\'ON\':\'OFF\'}'))throw new Error('Owner Auto Execute control is missing');
if(!vite.includes("/api/settings/auto-execute")||!vite.includes('writeAutoExecute(payload.enabled)'))throw new Error('Auto Execute settings API is missing');
if(bridge.includes('AUTO_EXECUTE_RETRY')||bridge.includes('setInterval'))throw new Error('Auto Execute added a retry scheduler');
console.log('Auto Execute V1 matrix passed');
