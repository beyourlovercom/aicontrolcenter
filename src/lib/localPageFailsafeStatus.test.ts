import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {formatLocalPageFailsafeStatus} from './localPageFailsafeStatus.ts';

const status:any={processRunning:true,serviceHealthy:true,repositoryAvailable:true,codexAvailable:true,port:1420,binding:'127.0.0.1',portOwner:'CANONICAL_AICC_SERVICE',supervisor:{state:'HEALTHY',managedPid:74880,consecutiveFailures:0,recoveryEpoch:221,recoveryAttempts:0,lastHealthFailure:'ETIMEDOUT',lastHealthDetail:'curl timeout\nwith detail'}};
const repository:any={repository:'/repo',branch:'dev/aicc-external-project-loading-v1',head:'abc123',localMain:'m',remoteMain:'m',worktree:'DIRTY',lastCommit:'abc'};
const output=formatLocalPageFailsafeStatus({pageRender:'FAILED',frontendBoot:'TIMEOUT',frontendError:'TypeError: boom\nsecond line',status,repository,timestamp:'2026-08-22T00:00:00.000Z'});
assert.match(output,/^AICC_LOCAL_PAGE_STATUS_V1/);
assert.match(output,/PAGE_RENDER = FAILED/);assert.match(output,/FRONTEND_BOOT = TIMEOUT/);
assert.match(output,/PORT_1420 = LISTENING/);assert.match(output,/HTTP_1420 = REACHABLE/);assert.match(output,/API_HEALTH = HEALTHY/);
assert.match(output,/SERVICE_PROCESS_RUNNING = YES/);assert.match(output,/SUPERVISOR_STATE = HEALTHY/);assert.match(output,/MANAGED_PID = 74880/);
assert.match(output,/BRANCH = dev\/aicc-external-project-loading-v1/);assert.match(output,/HEAD = abc123/);
assert.match(output,/LAST_HEALTH_DETAIL = curl timeout with detail/);assert.match(output,/FRONTEND_ERROR = TypeError: boom second line/);
assert.match(output,/END_AICC_LOCAL_PAGE_STATUS_V1$/);

const index=readFileSync(join(process.cwd(),'index.html'),'utf8'),main=readFileSync(join(process.cwd(),'src/main.ts'),'utf8'),vite=readFileSync(join(process.cwd(),'vite.config.ts'),'utf8');
assert.match(index,/FRONTEND_BOOT_TIMEOUT_MS = 45000/,'boot watchdog is bounded');
assert.match(index,/\/api\/aicc-local-page-status/,'failsafe uses independent local status endpoint');
assert.match(index,/document\.body\.textContent = text/,'failure replaces the unusable page with copyable text');
assert.match(index,/window\.__AICC_MARK_FRONTEND_READY__/,'normal UI can cancel the watchdog only after usable render');
assert.ok(index.indexOf('renderFailsafe')<index.indexOf('type="module" src="/src/main.ts"'),'failsafe boot shell exists before the Svelte module');
assert.match(main,/requestAnimationFrame[\s\S]*__AICC_MARK_FRONTEND_READY__/,'Svelte marks readiness after mount');
assert.match(vite,/server\.middlewares\.use\('\/api\/aicc-local-page-status'/,'pure-text status route exists beside health route');
assert.match(vite,/formatLocalPageFailsafeStatus/);assert.match(vite,/Content-Type','text\/plain; charset=utf-8'/);
console.log('AICC local page failsafe status V1 matrix passed');
