import assert from 'node:assert/strict';
import {chmodSync,mkdtempSync,mkdirSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {EventEmitter} from 'node:events';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPrNavigationApiHandler} from './prNavigationApi.ts';

const server=readFileSync(new URL('../../vite.config.ts',import.meta.url),'utf8');
const service=readFileSync(new URL('./controlService.ts',import.meta.url),'utf8');
const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const apiStart=server.indexOf("server.middlewares.use('/api/pr-navigation'");
const apiEnd=server.indexOf("server.middlewares.use('/api/pull-requests'",apiStart);
const roadmapStart=server.indexOf("server.middlewares.use('/api/roadmap'");
const roadmapEnd=server.indexOf("server.middlewares.use('/api/pr-navigation'",roadmapStart);
const api=server.slice(apiStart,apiEnd);
const roadmap=server.slice(roadmapStart,roadmapEnd);
const refreshStart=service.indexOf('export function refreshPrNavigationSnapshot');
const refreshEnd=service.indexOf('export function readPullRequests',refreshStart);
const refresh=service.slice(refreshStart,refreshEnd);

assert.ok(apiStart>=0&&apiEnd>apiStart,'PR navigation has a dedicated API route');
assert.match(api,/createPrNavigationApiHandler\(\{readSnapshot:readOrRebuildPersistedPrNavigationSnapshot,refreshSnapshot:refreshPrNavigationSnapshotAsync,snapshotPath:prNavigationSnapshotPath\}\)/,'the dedicated route rebuilds a missing read model through the guarded PR navigation handler');
assert.doesNotMatch(roadmap,/refreshPrNavigationSnapshot/,'Roadmap refresh never rebuilds the PR navigation snapshot');
assert.match(roadmap,/syncRoadmapProjection\(payload\)/,'Roadmap POST remains isolated to Roadmap projection refresh');
assert.equal((server.match(/refreshSnapshot:refreshPrNavigationSnapshot/g)??[]).length,1,'no other server route binds the PR refresh function');
assert.match(service,/export async function readOrRebuildPersistedPrNavigationSnapshot\(\):Promise<PrNavigationSnapshot>\{return readPersistedPrNavigationSnapshot\(\)\?\?refreshPrNavigationSnapshotAsync\(\);\}/,'a missing local read model rebuilds from GitHub canonical facts');
assert.match(service,/export function readPullRequests\(\):PullRequestRecord\[\]\{const snapshot=readPersistedPrNavigationSnapshot\(\);return snapshot\?snapshot\.records\.map\(record=>toPullRequestRecordLike\(record\) as PullRequestRecord\):\[\];\}/,'passive PR data reads use only the accepted local read model');
assert.ok(refresh.indexOf('const inputs=readLatestPrNavigationInputs();')>=0,'refresh reads factual inputs explicitly');
assert.ok(refresh.indexOf('const snapshot=buildPrNavigationSnapshot(')>refresh.indexOf('const inputs=readLatestPrNavigationInputs();'),'snapshot construction follows factual reads');
assert.ok(refresh.indexOf('atomicWriteJson(filePath,snapshot);')>refresh.indexOf('const snapshot=buildPrNavigationSnapshot('),'the accepted file is written only after construction succeeds');
assert.match(service,/function atomicWriteJson\(path:string,value:unknown\)\{const tmp=.*writeFileSync\(tmp,JSON\.stringify\(value,null,2\).*renameSync\(tmp,path\)\}/,'accepted snapshots use atomic replacement rather than a partial direct write');

const runtimeRefresh=app.match(/async function refreshRuntimeProjection\(\)\{([\s\S]*?)\n  async function refreshGlobalRuntimeProjection/)?.[1]??'';
const snapshotLoad=app.match(/async function performLoadSnapshot\(showFeedback=true,refreshCiEvidence=false\)\{([\s\S]*?)\n  async function loadSnapshot/)?.[1]??'';
const mount=app.match(/onMount\(\(\)=>\{([\s\S]*?)\}\);onDestroy/)?.[1]??'';
assert.ok(runtimeRefresh&&snapshotLoad&&mount,'automatic App refresh paths are identifiable');
assert.doesNotMatch(runtimeRefresh,/ci-evidence/,'runtime polling never performs live GitHub CI reads');
assert.match(snapshotLoad,/if\(refreshCiEvidence\)\{[^}]*boundedRequest\('\/api\/ci-evidence'\)/,'live CI evidence is gated by an explicit refresh option');
assert.doesNotMatch(mount,/loadSnapshot\(false,true\)/,'app mount never opts into live CI evidence');
assert.match(app,/if\(id==='REFRESH'\)await loadSnapshot\(false,true\)/,'the explicit Owner status refresh opts into live CI evidence');
assert.equal((app.match(/\/api\/ci-evidence/g)??[]).length,1,'App has exactly one gated live CI evidence read');

let routeRefreshCount=0;
const routeHandler=createPrNavigationApiHandler({readSnapshot:()=>({snapshot_version:7}),refreshSnapshot:()=>{routeRefreshCount+=1;return {snapshot_version:8}},snapshotPath:()=>'/tmp/pr-navigation-snapshot.json'});
const invokeRoute=async(method:string,headers:Record<string,string>={},body='')=>{
  const request=Object.assign(new EventEmitter(),{method,headers});
  let status=200;
  let responseBody='';
  const response={statusCode:200,setHeader:()=>{},end:(value?:string)=>{status=response.statusCode;responseBody=value??''}};
  const completed=new Promise<void>(resolve=>{const finish=()=>resolve();Object.defineProperty(response,'end',{value:(value?:string)=>{status=response.statusCode;responseBody=value??'';finish()}})});
  routeHandler(request as never,response as never);
  if(method==='POST'){request.emit('data',body);request.emit('end')}
  await completed;
  return {status,body:JSON.parse(responseBody)};
};
{
  let response=await invokeRoute('GET');
  assert.equal(response.status,200,'GET passively reads the persisted snapshot');
  assert.equal(routeRefreshCount,0,'GET never invokes refresh');
  response=await invokeRoute('POST',{origin:'https://attacker.example','content-type':'application/json'},'{}');
  assert.equal(response.status,403,'cross-origin refresh is rejected');
  response=await invokeRoute('POST',{'content-type':'application/json'},'{}');
  assert.equal(response.status,403,'a refresh without an explicit localhost Origin is rejected');
  response=await invokeRoute('POST',{origin:'http://localhost:1420'},'{}');
  assert.equal(response.status,415,'non-JSON refresh is rejected');
  response=await invokeRoute('POST',{origin:'http://localhost:1420','content-type':'application/json'});
  assert.equal(response.status,400,'an absent JSON body is rejected');
  response=await invokeRoute('POST',{origin:'http://127.0.0.1:1420','content-type':'application/json'},'not-json');
  assert.equal(response.status,400,'malformed JSON is rejected');
  response=await invokeRoute('POST',{origin:'http://127.0.0.1:1420','content-type':'application/json; charset=utf-8'},JSON.stringify({repository:'attacker-controlled'}));
  assert.equal(response.status,400,'caller-controlled factual input is rejected');
  assert.equal(routeRefreshCount,0,'every rejected request remains source-free');
  response=await invokeRoute('POST',{origin:'http://localhost:1420','content-type':'application/json'},'{}');
  assert.equal(response.status,200,'the explicit same-origin JSON refresh is accepted');
  assert.equal(routeRefreshCount,1,'only the accepted request invokes refresh');
}

const temporaryRoot=mkdtempSync(join(tmpdir(),'aicc-pr-navigation-refresh-'));
const stateDirectory=join(temporaryRoot,'state');
const fakeBin=join(temporaryRoot,'bin');
const fakeGh=join(fakeBin,'gh');
mkdirSync(stateDirectory,{recursive:true});
mkdirSync(fakeBin,{recursive:true});
const repository='beyourlovercom/aicontrolcenter';
const mappedWp='AICC-V2-PR-NAVIGATION-SNAPSHOT-001';
writeFileSync(join(stateDirectory,'delivery-context-records.json'),JSON.stringify([{delivery_context_id:'dc-pr-2',repository,pr_number:2,work_package_id:mappedWp}]));
const writeGh=(facts:unknown)=>{writeFileSync(fakeGh,`#!/bin/sh\nprintf '%s\\n' '${JSON.stringify([facts])}'\n`);chmodSync(fakeGh,0o700);};
const originalPath=process.env.PATH;
const originalStateDirectory=process.env.AICC_STATE_DIR;
try{
  writeGh([{number:2,title:'Snapshot PR',state:'open',draft:false,merged_at:null,html_url:'https://github.com/beyourlovercom/aicontrolcenter/pull/2',head:{ref:'feature/pr-2',sha:'head-2'},base:{ref:'main'},created_at:'2026-08-17T00:00:00.000Z',updated_at:'2026-08-17T00:00:00.000Z',mergeable_state:'clean'}]);
  process.env.PATH=`${fakeBin}:${originalPath??''}`;
  process.env.AICC_STATE_DIR=stateDirectory;
  const production=await import('./controlService.ts');
  const acceptedPath=join(stateDirectory,'03_AICC_PR_READ_MODEL.json');
  const first=production.refreshPrNavigationSnapshot('2026-08-17T01:00:00.000Z',acceptedPath);
  assert.equal(first.snapshot_version,1,'explicit refresh persists the first accepted version');
  assert.equal(first.records[0]?.prState,'OPEN','factual PR state is persisted from input');
  assert.equal(first.records[0]?.lifecycleStatus,'IN_PROGRESS','open PR lifecycle is persisted during explicit refresh');
  assert.equal(first.records[0]?.parentWpId,mappedWp,'only exact delivery-context evidence maps ownership');
  assert.equal(first.records[0]?.mappingStatus,'MAPPED','exact delivery-context mapping remains separate from lifecycle');
  writeGh([{number:2,title:'Snapshot PR',state:'closed',draft:false,merged_at:'2026-08-17T01:30:00.000Z',html_url:'https://github.com/beyourlovercom/aicontrolcenter/pull/2',head:{ref:'feature/pr-2',sha:'head-2'},base:{ref:'main'},created_at:'2026-08-17T00:00:00.000Z',updated_at:'2026-08-17T01:30:00.000Z',mergeable_state:'clean'}]);
  const second=production.refreshPrNavigationSnapshot('2026-08-17T02:00:00.000Z',acceptedPath);
  assert.equal(second.snapshot_version,2,'the next explicit refresh increments the accepted version');
  assert.equal(second.records[0]?.prState,'MERGED','the accepted factual state updates only on explicit refresh');
  assert.equal(second.records[0]?.lifecycleStatus,'COMPLETE','explicit refresh persists merged completion');
  const beforeFailure=readFileSync(acceptedPath,'utf8');
  writeFileSync(fakeGh,"#!/bin/sh\nexit 1\n");chmodSync(fakeGh,0o700);
  assert.throws(()=>production.refreshPrNavigationSnapshot('2026-08-17T03:00:00.000Z',acceptedPath),/PR_FACTS_UNAVAILABLE/,'failed factual reads reject the refresh');
  assert.equal(readFileSync(acceptedPath,'utf8'),beforeFailure,'failed refresh preserves the last accepted snapshot byte-for-byte');
  assert.deepEqual(readdirSync(stateDirectory).filter(name=>name.includes('.tmp')),[],'atomic replacement leaves no partial snapshot file');
}finally{
  if(originalPath===undefined)delete process.env.PATH;else process.env.PATH=originalPath;
  if(originalStateDirectory===undefined)delete process.env.AICC_STATE_DIR;else process.env.AICC_STATE_DIR=originalStateDirectory;
  rmSync(temporaryRoot,{recursive:true,force:true});
}

console.log('PR navigation refresh isolation contract passed');
