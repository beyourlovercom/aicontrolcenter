import {spawn as nodeSpawn,type ChildProcess} from 'node:child_process';
import {once} from 'node:events';

export const DEFAULT_CLAUDE_MODEL='claude-sonnet-4-6' as const;
export const DEFAULT_CLAUDE_EFFORT='low' as const;
export const ESCALATION_CLAUDE_MODEL='claude-sonnet-5' as const;

export type ClaudeLaunchPolicy={
  model?:string;
  effort?:'low'|'medium'|'high';
  gptEscalationEvidence?:string;
};
export type ClaudeProcess={pid:number|null;stdout:string;stderr:string;exitCode:number|null;startedAt:string;completedAt:string;model:string;effort:'low'|'medium'|'high';gptEscalationEvidence:string|null};
export type ClaudeProcessAdapter={spawn:(command:string,args:string[],options:{cwd:string})=>ChildProcess};

export function resolveClaudeLaunchPolicy(policy:ClaudeLaunchPolicy={}){
  if(policy.model==='sonnet')throw new Error('CLAUDE_AMBIGUOUS_MODEL_ALIAS_FORBIDDEN');
  const model=policy.model??DEFAULT_CLAUDE_MODEL;
  const effort=policy.effort??DEFAULT_CLAUDE_EFFORT;
  const evidence=policy.gptEscalationEvidence?.trim()||null;
  if(model.startsWith(ESCALATION_CLAUDE_MODEL)&&!evidence)throw new Error('CLAUDE_SONNET_5_REQUIRES_GPT_ESCALATION_EVIDENCE');
  return {model,effort,gptEscalationEvidence:evidence};
}

export async function executeClaude(instruction:string,repositoryRoot:string,adapter:ClaudeProcessAdapter={spawn:nodeSpawn},claudeBin='claude',policy:ClaudeLaunchPolicy={}):Promise<ClaudeProcess>{
  const launch=resolveClaudeLaunchPolicy(policy),startedAt=new Date().toISOString();
  const args=['-p',instruction,'--model',launch.model,'--effort',launch.effort,'--output-format','stream-json','--verbose'];
  const child=adapter.spawn(claudeBin,args,{cwd:repositoryRoot});let stdout='',stderr='';child.stdout?.on('data',chunk=>stdout+=String(chunk));child.stderr?.on('data',chunk=>stderr+=String(chunk));const [code]=await once(child,'close') as [number|null];return {pid:child.pid??null,stdout,stderr,exitCode:code,startedAt,completedAt:new Date().toISOString(),...launch};
}
