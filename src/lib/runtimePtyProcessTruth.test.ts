import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const supervisor=readFileSync(new URL('../../scripts/aicc-run-supervisor.ts',import.meta.url),'utf8');
const manager=readFileSync(new URL('./runtimeManager.ts',import.meta.url),'utf8');
const vite=readFileSync(new URL('../../vite.config.ts',import.meta.url),'utf8');
const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');

assert.match(supervisor,/import \* as pty from 'node-pty'/,'supervisor uses the installed PTY implementation');
assert.match(supervisor,/pty\.spawn\(command,ptyArgs/,'the real Codex command is spawned once through the PTY');
assert.doesNotMatch(supervisor,/import \{[^}]*\bspawn\b[^}]*\} from 'node:child_process'/,'supervisor does not launch a second display-only Codex process');
assert.match(supervisor,/ptySessionId=state\.ptySessionId\?\?`pty-\$\{state\.runId\}`/,'run ID deterministically owns one durable PTY session');
assert.match(supervisor,/state\.pid=child\.pid/,'runtime PID is the real PTY child PID');
assert.match(supervisor,/child\.onData/,'terminal chunks are emitted by the exact PTY process');
assert.match(supervisor,/terminalChunks/,'raw terminal evidence is persisted');
assert.match(supervisor,/parseEvent\(line,state,false\)/,'existing JSON event parsing consumes the same terminal process bytes');
assert.match(supervisor,/child\.onExit/,'real PTY exit is observed');
assert.match(supervisor,/terminalClosedAt/,'PTY close is persisted');
assert.match(manager,/if\(!runId\)throw new Error\("RUN_ID_REQUIRED"\)/,'runtime stop rejects implicit current-run selection');
assert.match(manager,/readStoredRuntimes\(\)\.find\(item=>item\.runId===runId\)/,'stop resolves only the requested durable run');
assert.match(manager,/process\.kill\(s\.pid, "SIGTERM"\)/,'stop terminates the exact requested process PID');
assert.match(vite,/RUN_ID_REQUIRED/,'stop API requires a run identifier');
assert.match(app,/post\('\/api\/codex\/stop',\{runId:displayRuntime\.runId\}\)/,'Owner stop targets the displayed run explicitly');
assert.match(supervisor,/terminalChunks=\[\.\.\.\(state\.terminalChunks\?\?\[\]\),text\]/,'each PTY stores only its own raw chunks');
console.log('runtime PTY process truth contract passed');
