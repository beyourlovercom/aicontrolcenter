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
assert(worker.includes('sourceReference: message.sourceReference')&&worker.includes('MARK_REPORT_INSERTED')&&worker.includes('deliveryKey'),'extension preserves exact conversation correlation and insertion idempotency');
assert(content.includes('reportCorrelation?.sourceReference !== location.href')&&content.includes("messageData?.type === 'INSERT_REPORT'"),'extension inserts only after worker delivery in the originating ChatGPT conversation');
assert(worker.includes('DELIVERY_STATE_PREFIX')&&worker.includes("state: 'PENDING'")&&worker.includes("state: 'CLAIMED'")&&worker.includes("state: 'DELIVERED'")&&worker.includes("state: 'ACKNOWLEDGED'"),'service worker owns durable delivery lifecycle');
const pollSource=worker.match(/async function pollResult[\s\S]*?(?=async function requestReportDelivery)/)?.[0]??'';
assert(worker.includes('REQUEST_REPORT_DELIVERY')&&worker.includes('chrome.tabs.sendMessage')&&!pollSource.includes('chrome.tabs.sendMessage'),'polling observes but does not independently deliver');
assert(content.includes("messageData?.type === 'INSERT_REPORT'")&&content.includes('deliveryKey'),'content inserts only after explicit worker delivery');
assert(content.includes('AUTO_REPORT_INSERT_DEFAULT = false'),'automatic production report insertion is off by default');
assert(content.includes('MANUAL_REPORT_INSERT_AVAILABLE = true')&&content.includes('data-aicc-insert')&&content.includes('插入运行报告'),'manual report fallback remains visible');
assert(content.includes("addEventListener('click', requestReportDelivery)")&&content.includes("message('REQUEST_REPORT_DELIVERY'"),'manual fallback is the only delivery trigger');
const contentPollSource=content.match(/async function pollResult[\s\S]*?(?=function reportText)/)?.[0]??'';
assert(!contentPollSource.includes('insertReport('),'read-only polling never inserts reports');
assert(!legacy.match(/correlation\.sourceReference === location\.href[\s\S]*?insert\(\)/),'legacy polling does not create an automatic delivery owner');
assert(legacy.includes('correlation.sourceReference !== location.href')&&legacy.includes('insertedPrefix'),'legacy adapter preserves exact conversation and one-time insertion');
assert(worker.includes("message?.type === 'SEND_INSTRUCTION'")&&!worker.includes("message?.type === 'AUTO_EXECUTE'"),'Terminal Handoff does not introduce Auto Execute');
console.log('terminal handoff contract tests passed');

function assert(condition:unknown,message:string){if(!condition)throw new Error(message)}
