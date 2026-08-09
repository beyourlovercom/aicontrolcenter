import { buildPrompt, parseEvent, type RuntimeState } from './runtimeManager.ts';
import { readWorkPackage } from './controlService.ts';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
function assert(x:unknown,m:string):asserts x{if(!x)throw new Error(m)}
const s:RuntimeState={runId:'r',workPackageId:'AICC-X-001',authorizationId:'a',authoritySha:'sha',branch:'feature/x',startingHeadSha:'head',pid:42,threadId:null,phase:'STARTING',currentTask:'',latestEvent:'',startedAt:'',lastActivityAt:'',events:[]};
parseEvent('{"type":"thread.started","thread_id":"t-1"}',s,false);assert(s.threadId==='t-1','thread id');parseEvent('{"type":"turn.started"}',s,false);assert(s.phase==='RUNNING','turn phase');parseEvent('{"type":"item.started","item":{"type":"command_execution"}}',s,false);assert(s.currentTask==='正在执行命令','task mapping');parseEvent('not-json',s,false);assert(s.events.includes('malformed_output'),'malformed safe');
const actual=readWorkPackage('AICC-V2-PR-RUNNER-001');assert(actual.goal.includes('After the AICC V2 First Usable Version'),'goal parsed');assert(actual.scope.includes('PR Runner foundation'),'scope parsed');assert(actual.acceptanceCriteria.includes('Owner authorization'),'acceptance parsed');assert(actual.rawMarkdown.includes('AICC PR Runner Foundation'),'raw markdown');const prompt=buildPrompt(actual.id,actual,{authorizationId:'a',workPackageId:actual.id,authoritySha:'sha',branch:'feature/x',headShaAtAuthorization:'head',repositoryRoot:'/Users/a/AI/007/AIcontrolcenter',scope:['read'],allowed:['tests'],forbidden:['push'],authorizedAt:'now'});assert(prompt.includes(actual.rawMarkdown)&&prompt.includes('Implement this Work Package now')&&!prompt.includes('arbitrary prompt'),'server prompt contract');console.log('runtime manager contract tests passed');
try { unlinkSync(join(homedir(), '.aicc-v2', 'runtime.json')); } catch { /* no test runtime persisted */ }
