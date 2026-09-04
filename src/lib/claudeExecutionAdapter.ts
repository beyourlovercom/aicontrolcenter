import {spawn as nodeSpawn,type ChildProcess} from 'node:child_process';
import {once} from 'node:events';

export type ClaudeProcess={pid:number|null;stdout:string;stderr:string;exitCode:number|null;startedAt:string;completedAt:string};
export type ClaudeProcessAdapter={spawn:(command:string,args:string[],options:{cwd:string})=>ChildProcess};
export async function executeClaude(instruction:string,repositoryRoot:string,adapter:ClaudeProcessAdapter={spawn:nodeSpawn},claudeBin='claude'):Promise<ClaudeProcess>{
  const startedAt=new Date().toISOString(),child=adapter.spawn(claudeBin,['-p',instruction,'--output-format','stream-json','--verbose'],{cwd:repositoryRoot});let stdout='',stderr='';child.stdout?.on('data',chunk=>stdout+=String(chunk));child.stderr?.on('data',chunk=>stderr+=String(chunk));const [code]=await once(child,'close') as [number|null];return {pid:child.pid??null,stdout,stderr,exitCode:code,startedAt,completedAt:new Date().toISOString()};
}
