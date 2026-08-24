import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {DEFAULT_CLAUDE_EFFORT,DEFAULT_CLAUDE_MODEL,ESCALATION_CLAUDE_MODEL,executeClaude,resolveClaudeLaunchPolicy} from './claudeExecutionAdapter.ts';

assert.deepEqual(resolveClaudeLaunchPolicy(),{model:DEFAULT_CLAUDE_MODEL,effort:DEFAULT_CLAUDE_EFFORT,gptEscalationEvidence:null});
assert.throws(()=>resolveClaudeLaunchPolicy({model:'sonnet'}),/CLAUDE_AMBIGUOUS_MODEL_ALIAS_FORBIDDEN/);
assert.throws(()=>resolveClaudeLaunchPolicy({model:ESCALATION_CLAUDE_MODEL,effort:'medium'}),/CLAUDE_SONNET_5_REQUIRES_GPT_ESCALATION_EVIDENCE/);
assert.throws(()=>resolveClaudeLaunchPolicy({model:`${ESCALATION_CLAUDE_MODEL}[1m]`,effort:'medium'}),/CLAUDE_SONNET_5_REQUIRES_GPT_ESCALATION_EVIDENCE/);
assert.deepEqual(resolveClaudeLaunchPolicy({model:ESCALATION_CLAUDE_MODEL,effort:'medium',gptEscalationEvidence:'GPT-ESC-001'}),{model:ESCALATION_CLAUDE_MODEL,effort:'medium',gptEscalationEvidence:'GPT-ESC-001'});

let capturedArgs:string[]=[];const child:any=new EventEmitter();child.pid=7;child.stdout={on:()=>child};child.stderr={on:()=>child};
const factsPromise=executeClaude('bounded task','/repo',{spawn:(_command:string,args:string[])=>{capturedArgs=args;queueMicrotask(()=>child.emit('close',0));return child}} as any,'claude');
const facts=await factsPromise;
assert.deepEqual(capturedArgs,['-p','bounded task','--model',DEFAULT_CLAUDE_MODEL,'--effort',DEFAULT_CLAUDE_EFFORT,'--output-format','stream-json','--verbose']);
assert.equal(facts.model,DEFAULT_CLAUDE_MODEL);assert.equal(facts.effort,DEFAULT_CLAUDE_EFFORT);assert.equal(facts.gptEscalationEvidence,null);
console.log('Claude model enforcement policy passed');
