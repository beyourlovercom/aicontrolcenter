import type {RuntimeRecord} from './model/entityTypes.ts';
import {createEmptyGlobalStateReadModel} from './globalStateReadModel.ts';
import {exactResultForRun,projectPhase5Lifecycle} from './runtimeResultFeedbackControlLoopProjection.ts';

export function resolveComposerCanonicalResult(runId:string|null,runtimes:RuntimeRecord[]):string|null{
  if(!runId)return null;
  const matches=runtimes.filter(run=>run.runId===runId);
  const identities=[...new Set(matches.map(run=>`${run.projectId}\u0000${run.repositoryIdentity}`))];
  if(matches.length===0||identities.length!==1)return null;
  const run=matches[0]!;
  const context={projectId:run.projectId,repositoryIdentity:run.repositoryIdentity,projectContextRevision:0};
  const projection=projectPhase5Lifecycle(createEmptyGlobalStateReadModel(context),{runs:[run]});
  return exactResultForRun(projection,runId)?.canonical?.rawResult??null;
}
