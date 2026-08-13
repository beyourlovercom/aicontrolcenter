import {readFileSync} from 'node:fs';

const bridge=readFileSync(new URL('./bridgeCore.ts',import.meta.url),'utf8');
const vite=readFileSync(new URL('../../vite.config.ts',import.meta.url),'utf8');
const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const content=readFileSync(new URL('../../web-adapter/chrome-extension/content.js',import.meta.url),'utf8');
const worker=readFileSync(new URL('../../web-adapter/chrome-extension/service-worker.js',import.meta.url),'utf8');
const legacy=readFileSync(new URL('../../web-adapter/chatgpt-aicc-bridge.js',import.meta.url),'utf8');

assert(bridge.includes('BridgeNotification')&&bridge.includes('saveTerminalNotification'),'terminal notifications use the bridge terminal reconciliation path');
assert(bridge.includes('AICC · Codex 执行完成')&&bridge.includes('AICC · Codex 执行失败')&&bridge.includes('AICC · Codex 执行已停止'),'terminal notification copy covers all terminal outcomes');
assert(bridge.includes('notifications.some(notification=>notification.runId===item.runId)'),'notification persistence is idempotent per terminal Run');
assert(vite.includes("/api/gpt-bridge/notifications")&&vite.includes('readNotifications()'),'canonical notifications are exposed through the local service');
assert(app.includes("request('/api/gpt-bridge/notifications')")&&app.includes('bridgeNotificationInitialized'),'AICC page consumes persisted terminal notifications without refresh re-notification');
assert(worker.includes('sourceReference: message.sourceReference')&&worker.includes('MARK_REPORT_INSERTED')&&worker.includes('alreadyInserted'),'extension preserves exact conversation correlation and insertion idempotency');
assert(content.includes('reportCorrelation?.sourceReference === location.href')&&content.includes('insertReport(true)'),'extension auto-inserts only in the originating ChatGPT conversation');
assert(legacy.includes('correlation.sourceReference === location.href')&&legacy.includes('insertedPrefix'),'legacy adapter preserves exact conversation and one-time insertion');
assert(worker.includes("message?.type === 'SEND_INSTRUCTION'")&&!worker.includes("message?.type === 'AUTO_EXECUTE'"),'Terminal Handoff does not introduce Auto Execute');
console.log('terminal handoff contract tests passed');

function assert(condition:unknown,message:string){if(!condition)throw new Error(message)}
