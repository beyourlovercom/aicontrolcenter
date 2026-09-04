import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../components/entity/RuntimeWorkspace.svelte',import.meta.url),'utf8');

assert.match(workspace,/ExecutionProviderPanel \{providerId\}[\s\S]*\{onProviderChange\}/,'the existing Execution Provider selector is connected to runtime workspace state');
assert.match(workspace,/aicc-selected-execution-provider/,'the selected provider has a shared App/runtime storage key');
assert.match(app,/const currentProvider=readExecutionProvider\(\)/,'Composer submission reads the current provider selection at submit time');
assert.match(app,/executionProvider:launchMetadata\?\.executionProvider\?\?currentProvider/,'Composer submission forwards the selected provider');
assert.match(app,/runnerId:launchMetadata\?\.runnerId\?\?\(currentProvider==='REMOTE_CLAUDE'\?'US-WAREHOUSE-01':undefined\)/,'REMOTE_CLAUDE submission forwards the canonical runner');
assert.match(app,/createCanonicalTask:true,\.\.\.selectedLaunchMetadata/,'canonical task creation receives the launch metadata');
console.log('composer provider propagation contract passed');
