export type BridgeProjectScope={projectId:string;repositoryIdentity:string};

export function bridgeRecordBelongsToProject(record:any,scope:BridgeProjectScope|null|undefined):boolean{
  return Boolean(scope&&record&&record.projectId===scope.projectId&&record.repositoryIdentity===scope.repositoryIdentity);
}

export function scopeBridgeRecords<T>(records:readonly T[]|null|undefined,scope:BridgeProjectScope|null|undefined):T[]{
  if(!scope||!Array.isArray(records))return [];
  return records.filter(record=>bridgeRecordBelongsToProject(record,scope));
}
