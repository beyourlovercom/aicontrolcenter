import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {DEFAULT_CLAUDE_EFFORT,DEFAULT_CLAUDE_MODEL,ESCALATION_CLAUDE_MODEL,executeClaude,resolveClaudeLaunchPolicy} from './claudeExecutionAdapter.ts';

assert.deepEqual(resolveClaudeLaunchPolicy(),{model:DEFAULT_CLAUDE_MODEL,effort:DEFAULT_CLAUDE_EFFORT,gptEscalationEvidence:null,gptEffortEscalationEvidence:null,gptSubagentEscalationEvidence:null,subagentsAllowed:false});
assert.throws(()=>resolveClaudeLaunchPolicy({model:'sonnet'}),/CLAUDE_AMBIGUOUS_MODEL_ALIAS_FORBIDDEN/);
assert.throws(()=>resolveClaudeLaunchPolicy({model:ESCALATION_CLAUDE_MODEL}),/CLAUDE_SONNET_5_REQUIRES_GPT_ESCALATION_EVIDENCE/);
assert.throws(()=>resolveClaudeLaunchPolicy({effort:'high'}),/CLAUDE_NONLOW_EFFORT_REQUIRES_GPT_EFFORT_ESCALATION_EVIDENCE/);
assert.equal(resolveClaudeLaunchPolicy({effort:'high',gptEffortEscalationEvidence:'GPT-EFFORT-001'}).effort,'high');
assert.equal(resolveClaudeLaunchPolicy({gptSubagentEscalationEvidence:'GPT-SUBAGENT-001'}).subagentsAllowed,true);
assert.equal(resolveClaudeLaunchPolicy({model:ESCALATION_CLAUDE_MODEL,gptEscalationEvidence:'GPT-MODEL-001'}).effort,'low');

let capturedArgs:string[]=[];let capturedOptions:any;const child:any=new EventEmitter();child.pid=7;child.stdout={on:()=>child};child.stderr={on:()=>child};
const facts=await executeClaude('bounded task','/repo',{spawn:(_command:string,args:string[],options:any)=>{capturedArgs=args;capturedOptions=options;queueMicrotask(()=>child.emit('close',0));return child}} as any,'claude');
assert.deepEqual(capturedArgs,['-p','bounded task','--model',DEFAULT_CLAUDE_MODEL,'--effort',DEFAULT_CLAUDE_EFFORT,'--output-format','stream-json','--verbose','--disallowedTools','Task']);
assert.equal(capturedOptions.env.AICC_CLAUDE_IMPLEMENTATION,'1');
assert.equal(facts.model,DEFAULT_CLAUDE_MODEL);assert.equal(facts.effort,DEFAULT_CLAUDE_EFFORT);assert.equal(facts.subagentsAllowed,false);
console.log('Claude model/effort/subagent execution enforcement policy passed');
