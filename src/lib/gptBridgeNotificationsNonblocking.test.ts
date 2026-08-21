import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readNotificationsAsync} from './bridgeCore.ts';

const vite=await readFile(new URL('../../vite.config.ts',import.meta.url),'utf8');
const bridge=await readFile(new URL('./bridgeCore.ts',import.meta.url),'utf8');
const route=vite.match(/server\.middlewares\.use\('\/api\/gpt-bridge\/notifications',[\s\S]*?\n  server\.middlewares\.use\('\/api\/gpt-bridge\/auto-loop'/)?.[0]??'';
assert.match(route,/readNotificationsAsync\(\)/,'notifications GET reads the persisted asynchronous snapshot');
assert.doesNotMatch(route,/readNotifications\(\)|reconcilePersistedExecutions|execFileSync|execSync|spawnSync/,'notifications GET does not enter synchronous execution reconciliation or child-process work');
const asyncReader=bridge.match(/export async function readNotificationsAsync[\s\S]*?export function resumeStoppedExecution/)?.[0]??'';
assert.match(asyncReader,/await readFile\(notificationsFile,'utf8'\)/,'notifications storage read is asynchronous');
assert.doesNotMatch(asyncReader,/readNotifications\(\)|reconcilePersistedExecutions|execFileSync|execSync|spawnSync/,'notifications async read has no synchronous child-process dependency');
let immediateRan=false;
const immediate=new Promise<void>(resolve=>setImmediate(()=>{immediateRan=true;resolve()}));
await Promise.all([readNotificationsAsync(),immediate]);
assert.equal(immediateRan,true,'notifications asynchronous read yields the event loop for concurrent work');
console.log('GPT Bridge notifications nonblocking regression passed');
