import {canonicalTaskResultForRun} from './taskResultProjection.ts';

type TaskRecord={
  taskId?:string;executionId?:string;runId?:string;latestRunId?:string;
  projectId?:string;repositoryIdentity?:string;canonicalResult?:any;
  runs?:Array<{runId?:string;executionId?:string;canonicalResult?:any}>;
};

export function resolveComposerCanonicalResult(runId:string|null,tasks:TaskRecord[]):string|null{
  if(!runId)return null;
  const matches=tasks.filter(task=>(task.latestRunId??task.runId??task.executionId)===runId||task.runs?.some(run=>run?.runId===runId));
  const identities=[...new Set(matches.map(task=>`${task.projectId??''}\0${task.repositoryIdentity??''}`))];
  if(matches.length!==1||identities.length!==1||identities[0]==='\0')return null;
  return canonicalTaskResultForRun(matches[0]!,runId)?.rawResult??null;
}
