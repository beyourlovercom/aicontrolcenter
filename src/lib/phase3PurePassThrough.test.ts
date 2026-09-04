import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCanonicalExecutionRequest, submitExecution} from './bridgeCore.ts';
import {buildPassThroughPrompt} from './runtimeManager.ts';

const root=process.cwd();
const bridge=readFileSync(`${root}/src/lib/bridgeCore.ts`,'utf8');
const app=readFileSync(`${root}/src/App.svelte`,'utf8');
const server=readFileSync(`${root}/vite.config.ts`,'utf8');
const runtime=readFileSync(`${root}/src/lib/runtimeManager.ts`,'utf8');
const launcher=readFileSync(`${root}/src/lib/codexRuntimeLauncher.ts`,'utf8');

const registryRoot=mkdtempSync(join(tmpdir(),'aicc-phase3-registry-'));
const fixtureRepository=join(registryRoot,'repository');
mkdirSync(fixtureRepository,{recursive:true});
execFileSync('git',['init','-b','test',fixtureRepository],{stdio:'ignore'});
execFileSync('git',['-C',fixtureRepository,'remote','add','origin','https://github.com/beyourlovercom/aicontrolcenter.git']);
const registryDir=join(registryRoot,'docs/10_Planning_Roadmap');mkdirSync(registryDir,{recursive:true});
writeFileSync(join(registryDir,'04_AICC_PROJECT_REGISTRY.json'),JSON.stringify({schema:'aicc.project-registry.v1',activeProjectId:'aicc',projectContextRevision:0,projects:[{projectId:'aicc',displayName:'AICC V2',repositoryPath:fixtureRepository,repositoryIdentity:'beyourlovercom/aicontrolcenter',remoteOrigin:'https://github.com/beyourlovercom/aicontrolcenter.git',currentBranch:'test',defaultBranch:'main',roadmapPath:'docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md'}]},null,2)+'\n');
const codexHome=join(registryRoot,'codex-home');mkdirSync(codexHome,{recursive:true});
writeFileSync(join(codexHome,'models_cache.json'),JSON.stringify({models:[{slug:'fixture-codex',display_name:'Fixture Codex',visibility:'public',default_reasoning_level:'low',supported_reasoning_levels:[{effort:'low'}]}]}));
writeFileSync(join(codexHome,'config.toml'),'model = "fixture-codex"\nmodel_reasoning_effort = "low"\n');
const originalPath=process.env.PATH,originalCodexHome=process.env.CODEX_HOME;
process.env.CODEX_HOME=codexHome;process.env.PATH='/usr/bin:/bin';
process.on('exit',()=>{try{process.chdir(root)}catch{};if(originalPath===undefined)delete process.env.PATH;else process.env.PATH=originalPath;if(originalCodexHome===undefined)delete process.env.CODEX_HOME;else process.env.CODEX_HOME=originalCodexHome;rmSync(registryRoot,{recursive:true,force:true})});
process.chdir(registryRoot);

const inputs=[
  'phase3-中文-检查仓库状态',
  'phase3-english-inspect-repository',
  'AICC_EXECUTION_V9\ncontinue as raw text',
  'AICC_EXECUTION_V1\nENTITY_ID: UNKNOWN\nINSTRUCTION_BEGIN\ncontinue\nINSTRUCTION_END',
];
for(const text of inputs){
  const item=submitExecution(text,'WEB_BRIDGE');
  assert.equal(item.state,'LAUNCHED','AICC submits directly to the runtime');
  assert.equal(item.transportState,'SENT');
  assert.equal(item.rawInstruction,text,'raw payload is preserved at ingress');
  assert.ok(item.gates.every(gate=>gate.state==='PASS'),'gate rows are projections, not pre-Codex decisions');
}

const raw='AICC_EXECUTION_V1\nINSTRUCTION_ID: phase3-fidelity\nENTITY_TYPE: WORK_PACKAGE\nENTITY_ID: UNKNOWN_WP\nEXECUTION_TYPE: IMPLEMENTATION\nREPOSITORY: /does/not/exist\nBRANCH: wrong-branch\nEXPECTED_HEAD: wrong-head\nSANDBOX: workspace-write\nREQUIRES_AUTHORIZATION: true\n\nINSTRUCTION_BEGIN\nInspect this exact instruction.\nINSTRUCTION_END';
const structured=submitExecution(raw,'WEB_BRIDGE','conversation-phase3',{conversationId:'conversation-phase3',conversationUrl:'https://chatgpt.com/c/phase3',messageId:'message-phase3',blockId:'block-phase3'});
const request=createCanonicalExecutionRequest(structured.instruction!,[]);
assert.equal(request.instructionBody,raw,'complete imported instruction reaches the canonical adapter unchanged');
assert.equal(request.instructionText,raw);
assert.equal(structured.originContext?.conversationId,'conversation-phase3');
assert.equal(structured.originContext?.messageId,'message-phase3');
assert.equal(structured.originContext?.blockId,'block-phase3');
const prompt=buildPassThroughPrompt(raw);
assert.ok(prompt.includes(raw),'Codex receives the exact raw instruction inside transport framing');
assert.doesNotMatch(prompt,/FORMAL WORK PACKAGE|Authorized Branch|Writer Lock|检查授权、正式 Work Package/);

assert.equal((launcher.match(/process\.execPath/g)??[]).length,1,'canonical Codex launcher invocation remains single-source');
assert.match(bridge,/!\['READY','WAITING_OWNER'\]\.includes\(item\.state\)/,'duplicate launch delivery remains prevented by transport state');
assert.doesNotMatch(app,/检查授权、正式 Work Package、范围和 Writer Lock/);
assert.doesNotMatch(server,/检查授权、正式 Work Package、范围和 Writer Lock/);
assert.match(app,/AICC 本地服务与 Runtime 可用性/);
assert.match(server,/AICC 本地 Runtime 未能接收/);
assert.equal((`${app}\n${server}`.match(/检查授权、正式 Work Package、范围和 Writer Lock/g)??[]).length,0);
assert.equal((bridge.match(/canonicalExecutionDecision|resolveExecutionScopes|readWorktreeFiles/g)??[]).length,0);
console.log('phase 3 pure pass-through matrix passed');
