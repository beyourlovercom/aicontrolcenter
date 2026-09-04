export const PR_NAVIGATION_SNAPSHOT_SCHEMA_VERSION='aicc.pr-navigation.snapshot.v1' as const;

export type PrNavigationSourceState='OPEN'|'DRAFT'|'MERGED'|'CLOSED';
export type PrLifecycleStatus='IN_PROGRESS'|'BLOCKED'|'COMPLETE';
export type PrMappingStatus='MAPPED'|'UNMAPPED';
export type PrNavigationFilter='ALL'|PrLifecycleStatus|'UNMAPPED';

export type PullRequestRecordLike={id:string;workPackageId?:string;status:string;number?:number;title?:string;repository?:string;url?:string;sourceBranch?:string;targetBranch?:string;deliveryBranch?:string;deliveryHeadSha?:string;prIdentity?:string;headSha?:string;state?:PrNavigationSourceState;draft?:boolean;createdAt?:string;updatedAt?:string;mergeState?:string};
export type PrNavigationSnapshotRecord={id:string;repository:string;prNumber:number;shortTitle:string;prState:PrNavigationSourceState;lifecycleStatus:PrLifecycleStatus;mappingStatus:PrMappingStatus;parentWpId:string|null;mapped:boolean;lastUpdated:string;title?:string;url?:string;sourceBranch?:string;targetBranch?:string;deliveryBranch?:string;deliveryHeadSha?:string;headSha?:string;createdAt?:string;updatedAt?:string;mergeState?:string};
export type PrNavigationSnapshot={schema_version:typeof PR_NAVIGATION_SNAPSHOT_SCHEMA_VERSION;snapshot_version:number;last_updated:string;records:PrNavigationSnapshotRecord[]};
export type PrNavigationSnapshotInput={id?:string;repository:string;prNumber:number;shortTitle?:string;title?:string;sourceState:PrNavigationSourceState;url?:string;sourceBranch?:string;targetBranch?:string;deliveryBranch?:string;deliveryHeadSha?:string;headSha?:string;createdAt?:string;updatedAt?:string;mergeState?:string;explicitBlockingFact?:boolean};

/** Returning `undefined` keeps an existing explicit mapping; `null` explicitly unmaps. */
export type PrNavigationMappingResolver=(input:PrNavigationSnapshotInput,previous:PrNavigationSnapshotRecord|null)=>string|null|undefined;

const sourceStates:readonly PrNavigationSourceState[]=['OPEN','DRAFT','MERGED','CLOSED'];
const lifecycleStatuses:readonly PrLifecycleStatus[]=['IN_PROGRESS','BLOCKED','COMPLETE'];
const mappingStatuses:readonly PrMappingStatus[]=['MAPPED','UNMAPPED'];
const optionalMetadataKeys=['title','url','sourceBranch','targetBranch','deliveryBranch','deliveryHeadSha','headSha','createdAt','updatedAt','mergeState'] as const;
const snapshotKeys=new Set(['schema_version','snapshot_version','last_updated','records']);
const recordKeys=new Set(['id','repository','prNumber','shortTitle','prState','lifecycleStatus','mappingStatus','parentWpId','mapped','lastUpdated',...optionalMetadataKeys]);
const legacyRecordKeys=new Set(['id','repository','prNumber','shortTitle','status','sourceState','progress','parentWpId','mapped','lastUpdated',...optionalMetadataKeys]);

function isObject(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value);}
function text(value:unknown):string|null{return typeof value==='string'&&value.trim().length>0?value.trim():null;}
function timestamp(value:unknown):string|null{const candidate=text(value);return candidate!==null&&Number.isFinite(Date.parse(candidate))?candidate:null;}
function positiveInteger(value:unknown):number|null{return typeof value==='number'&&Number.isSafeInteger(value)&&value>0?value:null;}
function sourceState(value:unknown):PrNavigationSourceState|null{return typeof value==='string'&&sourceStates.includes(value as PrNavigationSourceState)?value as PrNavigationSourceState:null;}
function lifecycleStatus(value:unknown):PrLifecycleStatus|null{return typeof value==='string'&&lifecycleStatuses.includes(value as PrLifecycleStatus)?value as PrLifecycleStatus:null;}
function mappingStatus(value:unknown):PrMappingStatus|null{return typeof value==='string'&&mappingStatuses.includes(value as PrMappingStatus)?value as PrMappingStatus:null;}
function sortRecords(records:PrNavigationSnapshotRecord[]):PrNavigationSnapshotRecord[]{return [...records].sort((left,right)=>left.prNumber-right.prNumber||left.repository.localeCompare(right.repository)||left.id.localeCompare(right.id));}

export function resolvePrLifecycleStatus(input:Pick<PrNavigationSnapshotInput,'sourceState'|'explicitBlockingFact'>):PrLifecycleStatus{
  if(input.sourceState==='MERGED')return 'COMPLETE';
  if(input.sourceState==='CLOSED'||input.explicitBlockingFact===true)return 'BLOCKED';
  return 'IN_PROGRESS';
}

function normalizedRecord(value:Record<string,unknown>,legacy=false):PrNavigationSnapshotRecord|null{
  const allowed=legacy?legacyRecordKeys:recordKeys;
  if(Object.keys(value).some(key=>!allowed.has(key)))return null;
  const id=text(value.id),repository=text(value.repository),shortTitle=text(value.shortTitle),prNumber=positiveInteger(value.prNumber),recordState=sourceState(legacy?value.sourceState:value.prState),lastUpdated=timestamp(value.lastUpdated);
  if(!id||!repository||!shortTitle||!prNumber||!recordState||!lastUpdated||typeof value.mapped!=='boolean')return null;
  const parentWpId=value.parentWpId===null?null:text(value.parentWpId);
  if(value.parentWpId!==null&&parentWpId===null)return null;
  const mapped=value.mapped,recordMapping=legacy?(mapped?'MAPPED':'UNMAPPED'):mappingStatus(value.mappingStatus),recordLifecycle=legacy?resolvePrLifecycleStatus({sourceState:recordState}):lifecycleStatus(value.lifecycleStatus);
  if(!recordMapping||!recordLifecycle||(mapped!==Boolean(parentWpId))||(mapped!==(recordMapping==='MAPPED')))return null;
  const record:PrNavigationSnapshotRecord={id,repository,prNumber,shortTitle,prState:recordState,lifecycleStatus:recordLifecycle,mappingStatus:recordMapping,parentWpId,mapped,lastUpdated};
  for(const key of optionalMetadataKeys){const metadata=value[key];if(metadata===undefined)continue;const normalized=text(metadata);if(normalized===null)return null;record[key]=normalized;}
  return record;
}

export function deserializePrNavigationSnapshot(value:unknown):PrNavigationSnapshot|null{
  if(!isObject(value)||value.schema_version!==PR_NAVIGATION_SNAPSHOT_SCHEMA_VERSION||Object.keys(value).some(key=>!snapshotKeys.has(key)))return null;
  const snapshotVersion=positiveInteger(value.snapshot_version),lastUpdated=timestamp(value.last_updated);
  if(!snapshotVersion||!lastUpdated||!Array.isArray(value.records))return null;
  const records=value.records.map(record=>isObject(record)?normalizedRecord(record,Object.hasOwn(record,'sourceState')):null);
  if(records.some(record=>record===null))return null;
  const normalizedRecords=records as PrNavigationSnapshotRecord[],identities=new Set<string>(),prIdentities=new Set<string>();
  for(const record of normalizedRecords){const prIdentity=`${record.repository}#${record.prNumber}`;if(identities.has(record.id)||prIdentities.has(prIdentity))return null;identities.add(record.id);prIdentities.add(prIdentity);}
  return {schema_version:PR_NAVIGATION_SNAPSHOT_SCHEMA_VERSION,snapshot_version:snapshotVersion,last_updated:lastUpdated,records:sortRecords(normalizedRecords)};
}

export function serializePrNavigationSnapshot(snapshot:PrNavigationSnapshot):string{const normalized=deserializePrNavigationSnapshot(snapshot);if(!normalized)throw new TypeError('Invalid PR navigation snapshot');return JSON.stringify(normalized);}

function normalizeInput(input:PrNavigationSnapshotInput):PrNavigationSnapshotInput|null{
  const repository=text(input.repository),prNumber=positiveInteger(input.prNumber),state=sourceState(input.sourceState);
  if(!repository||!prNumber||!state)return null;
  const title=text(input.title),shortTitle=text(input.shortTitle)??title??`PR #${prNumber}`,normalized:PrNavigationSnapshotInput={repository,prNumber,shortTitle,sourceState:state};
  const inputId=text(input.id);if(inputId)normalized.id=inputId;
  for(const key of optionalMetadataKeys){const value=input[key];if(value===undefined)continue;const normalizedValue=text(value);if(normalizedValue!==null)normalized[key]=normalizedValue;}
  if(input.explicitBlockingFact===true)normalized.explicitBlockingFact=true;
  if(title)normalized.title=title;
  return normalized;
}

export function buildPrNavigationSnapshot(inputs:readonly PrNavigationSnapshotInput[],previous:PrNavigationSnapshot|null,resolver:PrNavigationMappingResolver,updatedAt:string):PrNavigationSnapshot{
  const refreshTime=timestamp(updatedAt);if(!refreshTime)throw new TypeError('A valid refresh timestamp is required');
  const acceptedPrevious=previous===null?null:deserializePrNavigationSnapshot(previous),previousById=new Map((acceptedPrevious?.records??[]).map(record=>[record.id,record])),previousByPrIdentity=new Map((acceptedPrevious?.records??[]).map(record=>[`${record.repository}#${record.prNumber}`,record])),records:PrNavigationSnapshotRecord[]=[],identities=new Set<string>(),prIdentities=new Set<string>();
  for(const rawInput of inputs){const input=normalizeInput(rawInput);if(!input)throw new TypeError('Invalid PR navigation input');const id=input.id??`${input.repository}#${input.prNumber}`,prIdentity=`${input.repository}#${input.prNumber}`;
    if(identities.has(id)||prIdentities.has(prIdentity))throw new TypeError(`Duplicate PR navigation identity: ${prIdentity}`);identities.add(id);prIdentities.add(prIdentity);
    const prior=previousById.get(id)??previousByPrIdentity.get(prIdentity)??null,resolution=resolver(input,prior),parentWpId=resolution===undefined?(prior?.mapped?prior.parentWpId:null):resolution===null?null:text(resolution);
    if(resolution!==undefined&&resolution!==null&&parentWpId===null)throw new TypeError(`Invalid PR mapping for ${id}`);
    const mapped=parentWpId!==null,record:PrNavigationSnapshotRecord={id,repository:input.repository,prNumber:input.prNumber,shortTitle:input.shortTitle??`PR #${input.prNumber}`,prState:input.sourceState,lifecycleStatus:resolvePrLifecycleStatus(input),mappingStatus:mapped?'MAPPED':'UNMAPPED',parentWpId,mapped,lastUpdated:refreshTime};
    for(const key of optionalMetadataKeys){const value=input[key];if(value!==undefined)record[key]=value;}records.push(record);
  }
  return {schema_version:PR_NAVIGATION_SNAPSHOT_SCHEMA_VERSION,snapshot_version:(acceptedPrevious?.snapshot_version??0)+1,last_updated:refreshTime,records:sortRecords(records)};
}

export function projectPrNavigationSnapshot(snapshot:PrNavigationSnapshot,filter:PrNavigationFilter='ALL'):PrNavigationSnapshotRecord[]{const normalized=deserializePrNavigationSnapshot(snapshot);return normalized?filterPrNavigationSnapshotRecords(normalized.records,filter):[];}
export function filterPrNavigationSnapshotRecords(records:readonly PrNavigationSnapshotRecord[],filter:PrNavigationFilter='ALL'):PrNavigationSnapshotRecord[]{const ordered=sortRecords([...records]);return filter==='ALL'?ordered:filter==='UNMAPPED'?ordered.filter(record=>record.mappingStatus==='UNMAPPED'):ordered.filter(record=>record.lifecycleStatus===filter);}
export function toPullRequestRecordLike(record:PrNavigationSnapshotRecord):PullRequestRecordLike{const status=record.lifecycleStatus==='COMPLETE'?'COMPLETE':record.lifecycleStatus==='BLOCKED'?'BLOCKED':'IN_PROGRESS';return {id:record.id,workPackageId:record.parentWpId??undefined,status,number:record.prNumber,title:record.title??record.shortTitle,repository:record.repository,url:record.url,sourceBranch:record.sourceBranch,targetBranch:record.targetBranch,deliveryBranch:record.deliveryBranch,deliveryHeadSha:record.deliveryHeadSha,prIdentity:`${record.repository}#${record.prNumber}`,headSha:record.headSha,state:record.prState,draft:record.prState==='DRAFT',createdAt:record.createdAt,updatedAt:record.updatedAt,mergeState:record.mergeState};}
