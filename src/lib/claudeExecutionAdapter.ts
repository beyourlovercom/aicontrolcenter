import {spawn as nodeSpawn,type ChildProcess} from 'node:child_process';
import {once} from 'node:events';

export const DEFAULT_CLAUDE_MODEL='claude-sonnet-4-6' as const;
export const DEFAULT_CLAUDE_EFFORT='low' as const;
export const ESCALATION_CLAUDE_MODEL='claude-sonnet-5' as const;
export const GOVERNED_CLAUDE_BIN='/opt/homebrew/bin/claude' as const;

export type ClaudeLaunchPolicy={
  model?:string;
  effort?:'low'|'medium'|'high';
  gptEscalationEvidence?:string;
  gptEffortEscalationEvidence?:string;
  gptSubagentEscalationEvidence?:string;
};
export type ClaudeProcess={pid:number|null;stdout:string;stderr:string;exitCode:number|null;startedAt:string;completedAt:string;model:string;effort:'low'|'medium'|'high';gptEscalationEvidence:string|null;gptEffortEscalationEvidence:string|null;gptSubagentEscalationEvidence:string|null;subagentsAllowed:boolean};
export type ClaudeProcessAdapter={spawn:(command:string,args:string[],options:{cwd:string;env?:NodeJS.ProcessEnv})=>ChildProcess};

const evidence=(value?:string)=>value?.trim()||null;
export function resolveClaudeLaunchPolicy(policy:ClaudeLaunchPolicy={}){
  if(policy.model?.startsWith('sonnet'))throw new Error('CLAUDE_AMBIGUOUS_MODEL_ALIAS_FORBIDDEN');
  const model=policy.model??DEFAULT_CLAUDE_MODEL;
  const effort=policy.effort??DEFAULT_CLAUDE_EFFORT;
  const gptEscalationEvidence=evidence(policy.gptEscalationEvidence);
  const gptEffortEscalationEvidence=evidence(policy.gptEffortEscalationEvidence);
  const gptSubagentEscalationEvidence=evidence(policy.gptSubagentEscalationEvidence);
  if(model.startsWith(ESCALATION_CLAUDE_MODEL)&&!gptEscalationEvidence)throw new Error('CLAUDE_SONNET_5_REQUIRES_GPT_ESCALATION_EVIDENCE');
  if(effort!==DEFAULT_CLAUDE_EFFORT&&!gptEffortEscalationEvidence)throw new Error('CLAUDE_NONLOW_EFFORT_REQUIRES_GPT_EFFORT_ESCALATION_EVIDENCE');
  return {model,effort,gptEscalationEvidence,gptEffortEscalationEvidence,gptSubagentEscalationEvidence,subagentsAllowed:Boolean(gptSubagentEscalationEvidence)};
}

export async function executeClaude(instruction:string,repositoryRoot:string,adapter:ClaudeProcessAdapter={spawn:nodeSpawn},claudeBin:string=GOVERNED_CLAUDE_BIN,policy:ClaudeLaunchPolicy={}):Promise<ClaudeProcess>{
  const launch=resolveClaudeLaunchPolicy(policy),startedAt=new Date().toISOString();
  const args=['-p',instruction,'--model',launch.model,'--effort',launch.effort,'--output-format','stream-json','--verbose'];
  if(!launch.subagentsAllowed)args.push('--disallowedTools','Task');
  const env:NodeJS.ProcessEnv={...process.env,AICC_CLAUDE_IMPLEMENTATION:'1'};
  if(launch.gptEscalationEvidence)env.AICC_GPT_ESCALATION_EVIDENCE=launch.gptEscalationEvidence;
  if(launch.gptEffortEscalationEvidence)env.AICC_GPT_EFFORT_ESCALATION_EVIDENCE=launch.gptEffortEscalationEvidence;
  if(launch.gptSubagentEscalationEvidence)env.AICC_GPT_SUBAGENT_ESCALATION_EVIDENCE=launch.gptSubagentEscalationEvidence;
  const child=adapter.spawn(claudeBin,args,{cwd:repositoryRoot,env});let stdout='',stderr='';child.stdout?.on('data',chunk=>stdout+=String(chunk));child.stderr?.on('data',chunk=>stderr+=String(chunk));const [code]=await once(child,'close') as [number|null];return {pid:child.pid??null,stdout,stderr,exitCode:code,startedAt,completedAt:new Date().toISOString(),...launch};
}
