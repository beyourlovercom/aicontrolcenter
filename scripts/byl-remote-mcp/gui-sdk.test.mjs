import test from 'node:test';import assert from 'node:assert/strict';import {resolveMcpSdk,requireSdkPath} from './gui-sdk.mjs';
test('missing SDK is explicit',()=>assert.equal(resolveMcpSdk({requireFn:{resolve(){throw Error('MODULE_NOT_FOUND')}}}),null));
test('injected SDK path works',()=>assert.equal(resolveMcpSdk({requireFn:{resolve(){return '/app/node_modules/@modelcontextprotocol/sdk/package.json'}}}),'/app/node_modules/@modelcontextprotocol/sdk/package.json'));
test('never guess SDK from arbitrary machine path',()=>{try{requireSdkPath()}catch(e){assert.match(e.message,/MCP_SDK_DEPENDENCY_MISSING/)}});
