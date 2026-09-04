import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const css=readFileSync(new URL('../app.css',import.meta.url),'utf8');

assert.match(app,/SERVICE_STATE_STORAGE_KEY='aicc-local-service-last-state'/,'last known service state has a narrow UI-only storage key');
assert.match(app,/serviceState:'检查中'\|'正常'\|'降级'\|'已断开'\|'正在重连'\|'异常'=readLastServiceState\(\)/,'known status is restored before the first probe renders');
assert.match(app,/value&&\['正常','降级','已断开','正在重连','异常'\]\.includes\(value\)/,'known status is distinguished from first-load checking');
assert.match(app,/healthVerificationVisible=false/,'probe activity has an independent foreground visibility state');
assert.match(app,/healthVerificationVisible&&healthPollInFlight&&serviceState!=='检查中'\?' · 检查中':''/,'checking is secondary only during meaningful verification');
assert.match(app,/healthVerificationVisible=!refresh/,'background refresh probes remain visually silent');
assert.match(app,/healthVerificationVisible=false/,'verification visibility clears after the probe completes');
assert.match(app,/serviceTimer=window\.setInterval\(\(\)=>void pollService\(true\),1500\)/,'routine health polling remains enabled');
assert.doesNotMatch(app,/healthVerificationVisible=true;[^\n]*pollService\(true\)/,'routine polling never promotes probe activity into visible checking');
assert.doesNotMatch(app,/本地服务：\{serviceState\}[^\n]*AIcontrolcenter/,'the project name is removed from the Local Service header');
assert.match(app,/boundedRequest\('\/api\/health'\)/,'the existing health endpoint remains unchanged');
assert.match(app,/serviceTimer=window\.setInterval\(\(\)=>void pollService\(true\),1500\)/,'the existing health polling interval remains unchanged');
assert.match(css,/\.global-header\{/,'the existing header layout remains the styling authority');

console.log('header health refresh UI tests passed');
