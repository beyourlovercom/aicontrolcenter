import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {buildRuntimeObserver} from './runtimeObserver.ts';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../components/entity/RuntimeWorkspace.svelte',import.meta.url),'utf8');
const evidence=readFileSync(new URL('../components/entity/EntityEvidencePanel.svelte',import.meta.url),'utf8');

const active={runId:'run-active-fixture',workPackageId:'AICC-V2-GPT-BRIDGE-001',authorizationId:'auth-1',authoritySha:'sha',branch:'rebuild/aicc-v2',startingHeadSha:'head',pid:1234,pidAlive:true,threadId:'thread-1',phase:'RUNNING',currentTask:'正在执行命令',latestEvent:'item.started:command_execution',startedAt:'2026-08-13T04:00:00.000Z',lastActivityAt:'2026-08-13T04:00:01.000Z',events:['thread.started','turn.started','item.started:command_execution'],exitCode:null,completedAt:undefined} as any;
const model=buildRuntimeObserver(active,null,{status:'HELD',scope:'repository'},Date.parse('2026-08-13T04:00:02.000Z'));
assert.equal(model.status,'ACTIVE');
assert.equal(model.process,'ALIVE');
assert.equal(model.events.length,3);
assert.equal(model.elapsedMs,2000);
const terminal=buildRuntimeObserver({...active,phase:'COMPLETED',pidAlive:false,exitCode:0,completedAt:'2026-08-13T04:00:03.000Z'},null,{status:'NOT_HELD',scope:'repository'},Date.parse('2026-08-13T04:00:04.000Z'));
assert.equal(terminal.status,'COMPLETED');
assert.equal(terminal.process,'DEAD');
assert.match(app,/if activeTab==='运行'[\s\S]*<RuntimeWorkspace/);
assert.match(app,/runtimeHistory=Array\.isArray\(runtimeResult\.value\.history\)/);
assert.match(app,/const nextRuntime=data\.runtime&&typeof data\.runtime==='object'\?data\.runtime:null/);
assert.match(workspace,/data-testid="runtime-live-activity"[\s\S]*<RuntimeMonitor/);
assert.match(evidence,/displayRuntime=runtimeOverride\?\?context\.runtime/);
console.log('active runtime render matrix passed');
