import type {CanonicalExecutionResult,RuntimeRecord} from './model/entityTypes.ts';
import type {CanonicalTaskRecord,TaskRegistryProjection} from './bridgeCore.ts';
import type {AiccGlobalStateReadModel} from './globalStateReadModel.ts';

export const TASK_PROJECTION_SCHEMA_VERSION='aicc.task.projection.v1';
export const TASK_PROJECTION_CACHE_KEY='aicc.task.snapshot.v1';
export type TaskProjectionItem=CanonicalTaskRecord & {runtimeStatus:string|null;canonicalResult:CanonicalExecutionResult|null;resultId:string|null;resultHash:string|null};
export type TaskProjection={schemaVersion:typeof TASK_PROJECTION_SCHEMA_VERSION;generatedAt:string;items:TaskProjectionItem[];legacyCount:number;projectId?:string;repositoryIdentity?:string;projectContextRevision?:number;globalProjectionRevision?:number;entityRevisions?:AiccGlobalStateReadModel['entityRevisions']};
export function buildTaskProjection(registry:TaskRegistryProjection,runtimes:RuntimeRecord[]=[]):TaskProjection{
  const runtimeByRun=new Map(runtimes.filter(item=>item?.runId).map(item=>[item.runId,item]));
  const items=registry.items.map(task=>{const runtime=task.runId?runtimeByRun.get(task.runId):task.executionId?runtimeByRun.get(task.executionId):undefined;const result=runtime?.canonicalResult??null;return {...task,runtimeStatus:runtime?.phase??null,canonicalResult:result,resultId:result?.resultId??null,resultHash:result?.resultHash??null};});
  return {schemaVersion:TASK_PROJECTION_SCHEMA_VERSION,generatedAt:new Date().toISOString(),items,legacyCount:registry.legacy.length};
}
export function isTaskProjection(value:unknown):value is TaskProjection{if(!value||typeof value!=='object')return false;const candidate=value as Partial<TaskProjection>;return candidate.schemaVersion===TASK_PROJECTION_SCHEMA_VERSION&&Array.isArray(candidate.items)&&typeof candidate.legacyCount==='number';}
