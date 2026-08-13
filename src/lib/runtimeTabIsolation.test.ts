import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {readRuntimeLifecycleMetrics,recordAppMount,recordWorkspaceMount,resetRuntimeLifecycleMetrics} from './runtimeLifecycleInstrumentation.ts';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const main=readFileSync(new URL('../main.ts',import.meta.url),'utf8');
const runtime=readFileSync(new URL('../components/entity/RuntimeWorkspace.svelte',import.meta.url),'utf8');
assert.equal((main.match(/mount\(App/g)??[]).length,1,'App mounts once at startup');
assert.equal((app.match(/location\.reload|window\.location|history\.go/g)??[]).length,0,'runtime lifecycle has no document navigation');
assert.match(app,/async function refreshRuntimeProjection\(\)/,'runtime data projection is isolated');
assert.match(app,/activeTab==='运行'[\s\S]*<RuntimeWorkspace/,'Runtime workspace remains inside the active tab');
assert.match(runtime,/data-testid="runtime-live-activity"[\s\S]*<RuntimeMonitor/,'Runtime tab owns the live monitor');
assert.equal(app.includes('{#key'),false,'no keyed root/workspace remount boundary');
assert.equal(app.includes("if(refresh&&!['STARTING','RUNNING','STOPPING'].includes(raw.runtime?.phase??''))await loadSnapshot(false)"),true,'service recovery avoids global refresh during active runtime');
resetRuntimeLifecycleMetrics();recordAppMount();recordWorkspaceMount();const metrics=readRuntimeLifecycleMetrics();assert.deepEqual(metrics,{appMountCount:1,workspaceMountCount:1,fullPageRefreshCount:0},'instrumented lifecycle remains mounted without page refresh');
assert.match(app,/recordAppMount\(\)/);assert.match(runtime,/recordWorkspaceMount\(\)/);
console.log('runtime tab isolation matrix passed');
