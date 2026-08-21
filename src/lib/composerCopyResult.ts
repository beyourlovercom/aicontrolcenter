import type {RuntimeRecord} from './model/entityTypes.ts';

export function resolveComposerCanonicalResult(runId:string|null,runtimes:RuntimeRecord[]):string|null{
  if(!runId)return null;
  return runtimes.find((run)=>run.runId===runId)?.canonicalResult?.rawResult??null;
}
