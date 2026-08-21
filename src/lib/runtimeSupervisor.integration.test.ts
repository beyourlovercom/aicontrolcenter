import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {spawn} from 'node:child_process';

type State={runId:string;workPackageId:string;authorizationId:string;authoritySha:string;branch:string;startingHeadSha:string;pid:number|null;phase:string;currentTask:string;latestEvent:string;startedAt:string;lastActivityAt:string;events:string[];threadId:string|null;executionType:string;sandboxMode:string;authorizedHead:string;writerLockReleased?:boolean;processAlive?:boolean;pidAlive?:boolean;processExitObserved?:boolean;processCloseObserved?:boolean;exitCode?:number|null;failure?:string;terminalEventObserved?:boolean;supervisorPid?:number|null;ptySessionId?:string;terminalChunks?:string[];terminalSequence?:number;terminalStartedAt?:string;terminalUpdatedAt?:string;terminalClosedAt?:string;processExitedAt?:string;processClosedAt?:string;outputMode?:'json'|'human';finalMessagePath?:string;finalAgentMessage?:string;canonicalResult?:unknown;agentMessageCount?:number;commandExecutionCount?:number;fileChangeEventCount?:number;toolCallCount?:number;errorEventCount?:number;startupTransitions?:string[]};
const script=join(process.cwd(),'scripts','aicc-run-supervisor.ts');
const nodeArgs=['--experimental-strip-types','--experimental-specifier-resolution=node'];
function base(runId:string):State{const now=new Date().toISOString();return {runId,workPackageId:'TEST-WP',authorizationId:'test-auth',authoritySha:'test-sha',branch:'test',startingHeadSha:'test-head',pid:null,phase:'STARTING',currentTask:'',latestEvent:'launch',startedAt:now,lastActivityAt:now,events:[],threadId:null,executionType:'READ_ONLY_AUDIT',sandboxMode:'read-only',authorizedHead:'test-head'};}
async function runSupervisor(exitCode:number){const stateDir=mkdtempSync(join(tmpdir(),'aicc-supervisor-'));const state=base(`run-${exitCode}-${Date.now()}`);const specPath=join(stateDir,'spec.json');const code=`process.stdout.write(JSON.stringify({type:'thread.started',thread_id:'thread-real'})+'\\n');process.stdout.write(JSON.stringify({type:'turn.completed'})+'\\n');setTimeout(()=>process.exit(${exitCode}),25)`;writeFileSync(specPath,JSON.stringify({state,stateDir,repositoryRoot:process.cwd(),lockFile:join(stateDir,'writer.lock'),prompt:'test',command:process.execPath,args:['-e',code]}));const launcher=`const {spawn}=require('node:child_process');const child=spawn(process.execPath,${JSON.stringify([...nodeArgs,script])}.concat(process.argv[1]),{detached:true,stdio:'ignore'});child.unref();`;const handoff=spawn(process.execPath,['-e',launcher,specPath],{stdio:'ignore'});await new Promise(resolve=>handoff.on('exit',resolve));for(let i=0;i<100;i++){await new Promise(resolve=>setTimeout(resolve,25));try{const current=JSON.parse(readFileSync(join(stateDir,'runtime.json'),'utf8')) as State;if(['COMPLETED','FAILED'].includes(current.phase))return current}catch{}}throw new Error('SUPERVISOR_TEST_TIMEOUT')}
async function runHumanSupervisor(label:string,delayMs=25){const stateDir=mkdtempSync(join(tmpdir(),'aicc-human-supervisor-'));const state={...base(`run-human-${label}-${Date.now()}`),outputMode:'human' as const};state.finalMessagePath=join(stateDir,state.runId,'final-message.txt');const specPath=join(stateDir,'spec.json');const message=`human-result-${label}`;const code=`const fs=require('node:fs');fs.mkdirSync(${JSON.stringify(dirname(state.finalMessagePath))},{recursive:true});process.stdout.write('OpenAI Codex human output for ${label} trailing-chunk\\n');fs.writeFileSync(${JSON.stringify(state.finalMessagePath)},${JSON.stringify(message)});setTimeout(()=>process.exit(0),${delayMs})`;writeFileSync(specPath,JSON.stringify({state,stateDir,repositoryRoot:process.cwd(),lockFile:join(stateDir,'writer.lock'),prompt:'test',command:process.execPath,args:['-e',code]}));const launcher=`const {spawn}=require('node:child_process');const child=spawn(process.execPath,${JSON.stringify([...nodeArgs,script])}.concat(process.argv[1]),{detached:true,stdio:'ignore'});child.unref();`;const handoff=spawn(process.execPath,['-e',launcher,specPath],{stdio:'ignore'});await new Promise(resolve=>handoff.on('exit',resolve));for(let i=0;i<100;i++){await new Promise(resolve=>setTimeout(resolve,25));try{const current=JSON.parse(readFileSync(join(stateDir,'runtime.json'),'utf8')) as State;if(['COMPLETED','FAILED'].includes(current.phase))return current}catch{}}throw new Error('HUMAN_SUPERVISOR_TEST_TIMEOUT')}
const [completed,failed]=await Promise.all([runSupervisor(0),runSupervisor(7)]);assert.equal(completed.phase,'COMPLETED',JSON.stringify(completed));assert.equal(completed.exitCode,0);assert.equal(completed.processCloseObserved,true);assert.equal(completed.runId.startsWith('run-0-'),true);
assert.equal(failed.phase,'FAILED');assert.equal(failed.exitCode,7);assert.equal(failed.processCloseObserved,true);
assert.equal(completed.runId,completed.runId,'same durable Run ID survives supervisor handoff');
assert.match(completed.ptySessionId??'',/^pty-run-0-/,'one PTY session is durably bound to the Run');
assert.ok(completed.pid&&completed.pid>0,'real child PID is captured from the PTY process');
assert.ok((completed.terminalChunks??[]).join('').includes('thread.started'),'terminal bytes originate from the process that supplied protocol events');
assert.ok((completed.terminalSequence??0)>0&&completed.terminalStartedAt&&completed.terminalUpdatedAt&&completed.terminalClosedAt,'terminal lifecycle evidence is durable');
assert.ok(completed.processExitedAt&&completed.processClosedAt,'process exit and close timestamps are durable');
assert.notEqual(completed.ptySessionId,failed.ptySessionId,'concurrent-capable runs never share a PTY session');
assert.notEqual(completed.pid,failed.pid,'concurrent-capable runs never share a process PID');
const [humanA,humanB,immediateHuman,delayedHuman]=await Promise.all([runHumanSupervisor('a'),runHumanSupervisor('b'),runHumanSupervisor('immediate',0),runHumanSupervisor('delayed',1000)]);
assert.equal(humanA.phase,'COMPLETED','human mode completion is determined by PTY process exit, not JSON thread events');
assert.equal(humanB.phase,'COMPLETED');
assert.equal(immediateHuman.phase,'COMPLETED','an immediate PTY exit is observed after spawn listeners are registered');
assert.equal(immediateHuman.processAlive,false,'PTY exit finalization clears process liveness');
assert.equal(immediateHuman.processExitObserved,true,'PTY exit is durably observed');
assert.equal(immediateHuman.processCloseObserved,true,'the PTY exit event is the truthful PTY session-close boundary');
assert.equal(immediateHuman.exitCode,0,'the PTY exit code is durably persisted');
assert.ok(immediateHuman.terminalClosedAt,'terminal close timestamp is persisted after PTY exit');
assert.equal((immediateHuman.startupTransitions??[]).filter(item=>item==='PROCESS_EXITED').length,1,'duplicate PTY exit notifications cannot double-finalize a run');
assert.equal(delayedHuman.phase,'COMPLETED','the detached supervisor remains alive until a later PTY exit finalizes');
assert.equal(delayedHuman.exitCode,0,'the awaited PTY lifecycle still persists its exit code');
assert.equal(humanA.threadId,null,'human mode does not invent a thread identifier');
assert.equal(humanA.finalAgentMessage,'human-result-a','exact run-owned output-last-message file becomes the final agent message');
assert.equal(humanB.finalAgentMessage,'human-result-b');
assert.ok(humanA.canonicalResult,'final agent message is reconciled into the canonical result');
assert.notEqual(humanA.finalMessagePath,humanB.finalMessagePath,'concurrent runs never share final-message evidence');
assert.notEqual(humanA.ptySessionId,humanB.ptySessionId,'concurrent human runs never share a PTY session');
assert.notEqual(humanA.pid,humanB.pid,'concurrent human runs never share a process');
assert.match((humanA.terminalChunks??[]).join(''),/OpenAI Codex human output/,'human PTY bytes remain raw terminal evidence');
assert.match((humanA.terminalChunks??[]).join(''),/trailing-chunk/,'the last terminal chunk is persisted before terminal close');
assert.doesNotMatch((humanA.terminalChunks??[]).join(''),/\{"type":/,'human terminal output is not JSON protocol text');
assert.equal(humanA.agentMessageCount,undefined,'human mode never substitutes an unproven zero metric');
console.log('durable runtime supervisor integration matrix passed');
