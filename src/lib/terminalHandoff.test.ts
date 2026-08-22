import {readFileSync} from 'node:fs';

const bridge=readFileSync(new URL('./bridgeCore.ts',import.meta.url),'utf8');
const vite=readFileSync(new URL('../../vite.config.ts',import.meta.url),'utf8');
const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const content=readFileSync(new URL('../../web-adapter/chrome-extension-current/content.js',import.meta.url),'utf8');
const worker=readFileSync(new URL('../../web-adapter/chrome-extension-current/service-worker.js',import.meta.url),'utf8');
const legacy=readFileSync(new URL('../../web-adapter/chatgpt-aicc-bridge.js',import.meta.url),'utf8');

assert(bridge.includes('BridgeNotification')&&bridge.includes('saveTerminalNotification'),'terminal notifications use the bridge terminal reconciliation path');
assert(bridge.includes('AICC · Codex 执行完成')&&bridge.includes('AICC · Codex 执行失败')&&bridge.includes('AICC · Codex 执行已停止'),'terminal notification copy covers all terminal outcomes');
assert(bridge.includes('notification.runId===item.runId&&notification.projectId===item.projectId&&notification.repositoryIdentity===item.repositoryIdentity'),'notification persistence is idempotent per project-scoped terminal Run');
assert(vite.includes("/api/gpt-bridge/notifications")&&vite.includes('readNotifications()'),'canonical notifications are exposed through the local service');
assert(app.includes("request('/api/gpt-bridge/notifications')")&&app.includes('bridgeNotificationInitialized'),'AICC page consumes persisted terminal notifications without refresh re-notification');
assert(worker.includes('sourceReference: message.sourceReference')&&worker.includes('MARK_REPORT_INSERTED')&&content.includes('insertedResultIds'),'extension preserves exact conversation correlation and insertion idempotency');
assert(content.includes('reportCorrelation?.sourceReference === location.href')&&content.includes('exactOrigin ? composer() : null')&&content.includes("message('MARK_REPORT_INSERTED'"),'extension inserts only after an explicit Owner click in the originating ChatGPT conversation');
assert(worker.includes('MARK_REPORT_INSERTED')&&!worker.includes('DELIVERY_STATE_PREFIX'),'service worker stores only the canonical insertion acknowledgement');
const pollSource=worker.match(/async function pollResult[\s\S]*?(?=async function markReportInserted)/)?.[0]??'';
assert(worker.includes('POLL_RESULT')&&!pollSource.includes('chrome.tabs.sendMessage'),'polling observes but does not independently deliver');
assert(content.includes("message('MARK_REPORT_INSERTED'")&&!content.includes('messageData?.type === \'INSERT_REPORT\''),'content inserts only after explicit Owner delivery request');
assert(content.includes('AUTO_REPORT_INSERT_DEFAULT = false'),'automatic production report insertion is off by default');
assert(!content.includes('MANUAL_REPORT_INSERT_AVAILABLE = true')&&!content.includes('data-aicc-action-key="aicc-result"')&&!content.includes('requestReportDelivery'),'obsolete primary AICC result button path is removed');
assert(content.includes('function isInsertableReport')&&content.includes('item?.state === \'READY\'')&&content.includes('item?.report?.runId'),'runtime projection still recognizes canonical READY reports');
const contentPollSource=content.match(/async function pollResult[\s\S]*?(?=function reportText)/)?.[0]??'';
assert(!contentPollSource.includes('insertReport('),'read-only polling never inserts reports');
assert(content.includes('await insertReport()'),'remaining Runtime Result projection can use the existing AICC report formatter');
assert(!content.includes('INSERT_REPORT')&&!content.includes('deliverReport('),'content script has no automatic report delivery message path');
assert(!worker.includes('REQUEST_REPORT_DELIVERY')&&!worker.includes('chrome.tabs.sendMessage')&&!worker.includes('claimDelivery'),'service worker has no automatic Composer delivery path');
assert(!content.includes('data-aicc-action-key="aicc-result"'),'automatic insertion cannot recreate the removed primary action');
assert(!legacy.match(/correlation\.sourceReference === location\.href[\s\S]*?insert\(\)/),'legacy polling does not create an automatic delivery owner');
assert(legacy.includes('correlation.sourceReference !== location.href')&&legacy.includes('insertedPrefix'),'legacy adapter preserves exact conversation and one-time insertion');
assert(worker.includes("message?.type === 'SEND_INSTRUCTION'")&&!worker.includes("message?.type === 'AUTO_EXECUTE'"),'Terminal Handoff does not introduce Auto Execute');
console.log('terminal handoff contract tests passed');

function assert(condition:unknown,message:string){if(!condition)throw new Error(message)}
