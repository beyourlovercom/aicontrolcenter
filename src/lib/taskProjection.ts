import type {CanonicalExecutionResult,RuntimeRecord} from './model/entityTypes.ts';
import type {CanonicalTaskRecord,TaskRegistryProjection} from './bridgeCore.ts';
import type {AiccGlobalStateReadModel} from './globalStateReadModel.ts';

export const TASK_PROJECTION_SCHEMA_VERSION='aicc.task.projection.v1';
export const TASK_PROJECTION_CACHE_KEY='aicc.task.snapshot.v1';
export type TaskProjectionItem=CanonicalTaskRecord & {runtimeStatus:string|null;canonicalResult:CanonicalExecutionResult|null;resultId:string|null;resultHash:string|null};
export type TaskProjection={schemaVersion:typeof TASK_PROJECTION_SCHEMA_VERSION;generatedAt:string;items:TaskProjectionItem[];legacyCount:number;projectId?:string;repositoryIdentity?:string;projectContextRevision?:number;globalProjectionRevision?:number;entityRevisions?:AiccGlobalStateReadModel['entityRevisions']};
export function buildTaskProjection(registry:TaskRegistryProjection,runtimes:RuntimeRecord[]=[]):TaskProjection{
  const scopedKey=(value:{projectId?:string;repositoryIdentity?:string},runId?:string)=>value.projectId&&value.repositoryIdentity&&runId?`${value.projectId}\x00${value.repositoryIdentity}\x00${runId}`:null;
  const runtimeByRun=new Map(runtimes.filter(item=>item?.runId).map(item=>[scopedKey(item,item.runId)??item.runId,item]));
  const items=registry.items.map(task=>{const taskRunId=task.latestRunId??task.runId??task.executionId;const key=taskRunId?(scopedKey(task,taskRunId)??taskRunId):null,runtime=key?runtimeByRun.get(key):undefined,run=taskRunId?task.runs?.find(item=>item.runId===taskRunId):undefined,result=run?.canonicalResult??(task.runId===taskRunId?task.canonicalResult:undefined)??null;return {...task,runtimeStatus:runtime?.phase??run?.status??null,canonicalResult:result,resultId:result?.resultId??null,resultHash:result?.resultHash??null};});
  return {schemaVersion:TASK_PROJECTION_SCHEMA_VERSION,generatedAt:new Date().toISOString(),items,legacyCount:registry.legacy.length};
}
export function isTaskProjection(value:unknown):value is TaskProjection{if(!value||typeof value!=='object')return false;const candidate=value as Partial<TaskProjection>;return candidate.schemaVersion===TASK_PROJECTION_SCHEMA_VERSION&&Array.isArray(candidate.items)&&typeof candidate.legacyCount==='number';}
