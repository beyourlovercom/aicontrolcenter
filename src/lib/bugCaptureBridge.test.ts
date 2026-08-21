import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {captureBug,formatBugCaptureResult,parseBugCaptureV1} from './bugCaptureBridge.ts';

const temporary=mkdtempSync(join(tmpdir(),'aicc-bug-capture-'));
const registryPath=join(temporary,'01_bug_record.md'),statePath=join(temporary,'bug-captures.json');
const registry=`# AICC Bug Record

## Open Bug Summary

| Bug ID | Severity | Status | Module | Title | Blocks Current Scope | Discovered At |
|---|---|---|---|---|---|---|
| AICC-BUG-001 | UNTRIAGED | Reported | Existing | Existing Bug | UNKNOWN | 2026-08-20 |

## Bug Records

## AICC-BUG-001

- Title: Existing Bug

### Additional Evidence

- Existing evidence
`;
function payload(captureId:string,overrides:{title?:string;severity?:string;existingBugId?:string}={}){return `AICC_BUG_CAPTURE_V1

CAPTURE_ID: ${captureId}
TITLE: ${overrides.title??'Bridge capture regression'}

SEVERITY: ${overrides.severity??'UNTRIAGED'}
STATUS: Reported

AFFECTED_MODULE: GPT Bug Capture Bridge
BLOCKS_CURRENT_SCOPE: NO

EXPECTED:
Only explicit captures are recorded exactly once.

ACTUAL:
Capture evidence supplied for registry ingestion.

REPRODUCTION:
Submit this complete protocol payload.

EVIDENCE:
Focused bridge contract evidence.

ENVIRONMENT:
test

DISCOVERED_BY:
GPT

SOURCE_CONVERSATION:
conversation-test

SOURCE_MESSAGE:
message-test

RECOMMENDED_ROUTING:
DEFER
${overrides.existingBugId?`EXISTING_BUG_ID: ${overrides.existingBugId}\n`:''}END_AICC_BUG_CAPTURE_V1`}

try{
  writeFileSync(registryPath,registry);
  const options={registryPath,statePath,now:()=> '2026-08-20T12:00:00.000Z'};
  assert.throws(()=>parseBugCaptureV1('ordinary chat says bug failure error'),/BUG_CAPTURE_PROTOCOL_REQUIRED/,'ordinary chat is never classified as a Bug');
  const created=captureBug(payload('capture-new-0001'),{conversationId:'conversation-test',messageId:'message-test'},options);
  assert.deepEqual(created,{captureId:'capture-new-0001',result:'CREATED',bugId:'AICC-BUG-002',registry:'docs/80_Bug_Record/01_bug_record.md',mainlineInterrupted:'NO',fixStarted:'NO'});
  const once=captureBug(payload('capture-new-0001'),{conversationId:'conversation-test',messageId:'message-test'},options);
  assert.deepEqual(once,created,'the same capture identity is exactly once across retry/remount');
  let text=readFileSync(registryPath,'utf8');
  assert.equal((text.match(/^## AICC-BUG-002$/gm)??[]).length,1,'one capture creates exactly one stable Bug ID');
  const updated=captureBug(payload('capture-update-0002',{existingBugId:'AICC-BUG-002'}),{conversationId:'conversation-test',messageId:'message-update'},options);
  assert.equal(updated.result,'UPDATED');assert.equal(updated.bugId,'AICC-BUG-002');
  text=readFileSync(registryPath,'utf8');
  assert.equal((text.match(/^## AICC-BUG-002$/gm)??[]).length,1,'explicit existing Bug identity prevents duplicates');
  assert.match(text,/Capture ID: capture-update-0002/,'new evidence is appended to the existing canonical record');
  const uncertain=captureBug(payload('capture-uncertain-0003'),{conversationId:'conversation-test',messageId:'message-uncertain'},options);
  assert.equal(uncertain.result,'NEEDS_TRIAGE','an exact title match without explicit Bug identity is not semantically auto-merged or duplicated');
  assert.equal(uncertain.bugId,'NOT_ASSIGNED');
  const p0=captureBug(payload('capture-p0-0004',{title:'Explicit P0 capture',severity:'P0'}),{conversationId:'conversation-test',messageId:'message-p0'},options);
  assert.equal(p0.mainlineInterrupted,'YES');assert.equal(p0.fixStarted,'NO','routing never authorizes an automatic fix');
  assert.match(formatBugCaptureResult(created),/AICC_BUG_CAPTURE_RESULT_V1[\s\S]*RESULT: CREATED[\s\S]*FIX_STARTED: NO/);
}finally{rmSync(temporary,{recursive:true,force:true})}

const content=readFileSync(new URL('../../web-adapter/chrome-extension-current/content.js',import.meta.url),'utf8');
const worker=readFileSync(new URL('../../web-adapter/chrome-extension-current/service-worker.js',import.meta.url),'utf8');
const vite=readFileSync(new URL('../../vite.config.ts',import.meta.url),'utf8');
assert.match(content,/explicitBugCaptureBlocks[\s\S]*AICC_BUG_CAPTURE_V1[\s\S]*END_AICC_BUG_CAPTURE_V1/,'content bridge detects only explicit complete protocol blocks');
assert.match(content,/message\('BUG_CAPTURE', \{ payload, originContext \}\)/,'capture preserves exact message origin');
assert.match(worker,/async function captureBug[\s\S]*\/api\/gpt-bridge\/bug-capture/,'extension forwards only the explicit payload to AICC');
assert.match(vite,/\/api\/gpt-bridge\/bug-capture[\s\S]*captureBug\(payload\.payload,payload\.originContext\)/,'AICC Bridge owns canonical registry mutation');
assert.doesNotMatch(content,/includes\(['"]bug['"]\)|includes\(['"]failure['"]\)|includes\(['"]error['"]\)/i,'ordinary Bug-related words do not trigger capture');
console.log('GPT Bug Capture Bridge tests passed');
