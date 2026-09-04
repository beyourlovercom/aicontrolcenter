import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../../',import.meta.url);
const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const runtime=readFileSync(new URL('./runtimeManager.ts',import.meta.url),'utf8');
const bridge=readFileSync(new URL('./bridgeCore.ts',import.meta.url),'utf8');
const server=readFileSync(new URL('../../vite.config.ts',import.meta.url),'utf8');

const runtimeRead=runtime.match(/export async function readRuntimeProjectionSnapshot[\s\S]*?export function readRuntime\(/)?.[0]??'';
const taskRead=bridge.match(/export async function readTaskProjectionReadOnly[\s\S]*?function readRawOutbox/)?.[0]??'';
const runtimeRoute=server.match(/server\.middlewares\.use\('\/api\/codex\/runtime'[\s\S]*?\n  server\.middlewares\.use\('\/api\/codex\/retry'/)?.[0]??'';
const selectedRefresh=app.match(/async function refreshRuntimeProjection\(\)\{([\s\S]*?)\n  async function refreshGlobalRuntimeProjection/)?.[1]??'';

assert.match(app,/runtimeProjectionRefreshInFlight:Promise<any>\|null=null/,'frontend stores the active projection refresh promise');
assert.match(selectedRefresh,/if\(runtimeProjectionRefreshInFlight\)return runtimeProjectionRefreshInFlight/,'frontend refresh is single-flight at the function boundary');
assert.match(runtime,/let runtimeProjectionRefresh:Promise<RuntimeProjectionSnapshot>\|null=null/,'server stores one active Runtime rebuild');
assert.match(runtime,/if\(runtimeProjectionRefresh\)return runtimeProjectionRefresh/,'server Runtime rebuild is single-flight');
assert.match(runtime,/RUNTIME_PROJECTION_BATCH_SIZE/,'Runtime rebuild yields between bounded batches');
assert.match(runtime,/readRuntimeFileCached/,'unchanged Runtime files use metadata-cached parsed state');
assert.match(runtime,/export function invalidateRuntimeProjectionSnapshot\(\)/,'canonical Runtime changes explicitly invalidate the snapshot');
assert.match(runtime,/export function startRuntimeProjectionMonitoring\(\)/,'external canonical Runtime writes are monitored as data changes');
assert.match(runtime,/locallyWrittenRuntimeProjectionFiles/,'Runtime local writes suppress duplicate watcher rebuilds');
assert.doesNotMatch(runtime,/RUNTIME_PROJECTION_FRESHNESS_MS|Date\.now\(\)-runtimeProjectionSnapshot\.refreshedAt/,'Runtime snapshots have no time-based freshness trigger');
assert.doesNotMatch(runtimeRead,/readFileSync\(|readdirSync\(/,'async Runtime GET readers do not synchronously scan files');
assert.doesNotMatch(runtimeRead,/refreshRuntimeProjectionSnapshot\(/,'Runtime GET readers never rebuild the snapshot');
assert.doesNotMatch(taskRead,/readFileSync\(|readdirSync\(/,'Task projection GET reader does not synchronously scan files');
assert.doesNotMatch(taskRead,/refreshTaskProjectionSnapshot\(/,'Task GET readers never rebuild the snapshot');
assert.match(bridge,/taskProjectionSnapshot/,'Task GET uses an in-memory projection snapshot');
assert.match(bridge,/let taskProjectionRefresh:Promise<TaskProjection>\|null=null/,'Task projection rebuild is single-flight');
assert.match(bridge,/export function invalidateTaskProjectionSnapshot\(\)/,'Task canonical writes explicitly invalidate the projection');
assert.match(bridge,/export function startTaskProjectionMonitoring\(\)/,'external Task canonical writes are monitored as data changes');
assert.match(bridge,/locallyWrittenTaskProjectionFiles/,'Task local writes suppress duplicate watcher rebuilds');
assert.doesNotMatch(bridge,/startBridgeProjectionReconciliation|bridgeProjectionTimer|setInterval\(/,'Bridge projection has no periodic rebuild timer');
assert.match(runtimeRoute,/readRuntimeReadOnly\(/,'Runtime route consumes the read-optimized Runtime API');
assert.match(runtimeRoute,/readRuntimeHistoryAsync\(\)/,'Runtime route consumes the shared Runtime history snapshot');
assert.match(server,/readOutboxAsync\(\)/,'outbox GET uses an asynchronous passive read');
assert.match(server,/startRuntimeProjectionMonitoring\(\)/,'server starts Runtime snapshot initialization and data-change monitoring once');
assert.match(server,/initializeTaskProjectionSnapshot\(\)/,'server performs one startup Task projection build');
assert.match(server,/startTaskProjectionMonitoring\(\)/,'server starts Task data-change monitoring once');
assert.doesNotMatch(bridge.match(/export async function readOutboxAsync[\s\S]*?export function readNotifications/)?.[0]??'',/reconcileBridgeProjectionAsync/,'outbox GET does not trigger reconciliation');

console.log('Runtime/Task projection event-loop starvation guards passed');
