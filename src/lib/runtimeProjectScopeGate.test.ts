import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createProjectRegistryAuthority} from './projectRegistryAuthority.ts';
import {projectEntityScope} from './projectEntityScope.ts';
import {resolveRuntimeProjectScope} from './runtimeManager.ts';

const active=createProjectRegistryAuthority().getActiveProject();
const scope=projectEntityScope(active);
assert.deepEqual(resolveRuntimeProjectScope(scope),scope,'registered project scope resolves through Project Registry');
if(active.canonicalRepositoryPath)assert.deepEqual(resolveRuntimeProjectScope({...scope,repositoryPath:active.canonicalRepositoryPath}),scope,'canonical filesystem alias resolves to registered project');
assert.throws(()=>resolveRuntimeProjectScope({...scope,projectId:'not-registered'}),/PROJECT_NOT_REGISTERED/);
assert.throws(()=>resolveRuntimeProjectScope({...scope,repositoryIdentity:'wrong\/repo'}),/PROJECT_REPOSITORY_IDENTITY_MISMATCH/);
assert.throws(()=>resolveRuntimeProjectScope({...scope,repositoryPath:'/tmp'}),/PROJECT_REPOSITORY_PATH_MISMATCH/);

const runtime=readFileSync(new URL('./runtimeManager.ts',import.meta.url),'utf8');
assert.ok(runtime.indexOf('const projectScope=resolveRuntimeProjectScope(options.projectScope);')<runtime.indexOf('const task=ensureTaskBeforeRun('),'Project Registry gate must precede Task persistence');
const runtimeScopeGate=runtime.slice(runtime.indexOf('export function resolveRuntimeProjectScope'),runtime.indexOf('export function startRuntime('));
assert.match(runtimeScopeGate,/getProject\(requested\.projectId\)/,'execution scope gate retains validated Project Registry lookup');
assert.match(runtimeScopeGate,/getActiveProject\(\)/,'default execution scope retains validated active-project lookup');
const bridge=readFileSync(new URL('./bridgeCore.ts',import.meta.url),'utf8');
const launch=bridge.slice(bridge.indexOf('export function launchInboxItem('),bridge.indexOf('function launchRemoteInboxItem('));
assert.ok(launch.indexOf('const projectScope=resolveRuntimeProjectScope(')<launch.indexOf("executionProvider==='REMOTE_CLAUDE'"),'provider dispatch must occur after Project Registry gate');
console.log('Runtime Project Registry scope gate passed');
