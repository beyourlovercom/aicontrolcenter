import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {resolveAiccStateDir} from './stateDirectory.ts';

const resolved=resolveAiccStateDir();
assert.ok(resolved,'test runner provides an isolated AICC_STATE_DIR');
assert.equal(resolveAiccStateDir(),resolved);
assert.equal(resolveAiccStateDir({AICC_STATE_DIR:'  /tmp/aicc-state  '} as NodeJS.ProcessEnv,'/Users/a'),'/tmp/aicc-state');
assert.equal(resolveAiccStateDir({} as NodeJS.ProcessEnv,'/Users/a'),'/Users/a/.aicc-v2');
assert.ok(resolved.startsWith(tmpdir()),'test state is temporary');
assert.equal(existsSync(join(resolved,'runtime.json')),false,'isolated state starts empty');
const sources=['bridgeCore.ts','controlService.ts','fastExecution.ts','runtimeManager.ts','canaryRuntimeTrigger.ts'].map(file=>readFileSync(new URL(`./${file}`,import.meta.url),'utf8')).join('\n');
assert.doesNotMatch(sources,/join\(homedir\(\),\s*['"]\.aicc-v2['"]/,'durable state consumers use the canonical resolver');
console.log('AICC state directory isolation contract passed');
