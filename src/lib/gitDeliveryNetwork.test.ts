import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const supervisor=readFileSync(new URL('../../scripts/aicc-run-supervisor.ts',import.meta.url),'utf8');

assert.match(supervisor,/sandbox_workspace_write\.network_access=true/);
assert.match(supervisor,/mkdtempSync\(join\(tmpdir\(\),'aicc-gh-config-'/);
assert.match(supervisor,/environment\.GH_CONFIG_DIR=ephemeralGithubConfigDir/);
assert.match(supervisor,/stripGitHubCredentialEnvironment\(process\.env\)/);
assert.match(supervisor,/cleanupEphemeralGitHubCredential/);
assert.equal((supervisor.match(/sandbox_workspace_write\.network_access=true/g)??[]).length,1);
console.log('git delivery network boundary matrix passed');
