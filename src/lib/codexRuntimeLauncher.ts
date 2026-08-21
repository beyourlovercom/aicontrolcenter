import {spawn,type ChildProcess} from 'node:child_process';

export type CodexLaunchRequest={executionId:string;instructionId?:string;repository:string;branch:string;sandbox:'workspace-write'|'read-only';specFile:string;supervisorScript:string};
export type CodexLaunchResult={processId:number|null;runtimeState:'STARTING'|'FAILED';failure?:'CODEX_RUNTIME_UNAVAILABLE'|'CODEX_LAUNCH_FAILED';process?:ChildProcess};
export type CodexLauncherDependencies={available:boolean;spawnProcess?:typeof spawn};
const launchKeys=new Set<string>();
export function launchCodexRuntime(request:CodexLaunchRequest,deps:CodexLauncherDependencies):CodexLaunchResult{
  if(launchKeys.has(request.executionId))return {processId:null,runtimeState:'FAILED',failure:'CODEX_LAUNCH_FAILED'};
  if(!deps.available)return {processId:null,runtimeState:'FAILED',failure:'CODEX_RUNTIME_UNAVAILABLE'};
  try{const child=(deps.spawnProcess??spawn)(process.execPath,['--experimental-strip-types','--experimental-specifier-resolution=node',request.supervisorScript,request.specFile],{cwd:request.repository,detached:true,stdio:'ignore'});launchKeys.add(request.executionId);child.unref();return {processId:child.pid??null,runtimeState:'STARTING',process:child};}catch{return {processId:null,runtimeState:'FAILED',failure:'CODEX_LAUNCH_FAILED'}}
}
