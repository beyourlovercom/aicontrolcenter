import type {SelectedEntityRef} from './model/entityTypes.ts';

/** Entity detail surfaces may consume only explicitly correlated records. */
export function scopeInboxToEntity<T extends {instruction?: {workPackageId?: string; entityType?: string; entityId?: string}}>(items:T[], entity:SelectedEntityRef):T[]{
  if(entity.type==='work_package')return items.filter(item=>item.instruction?.workPackageId===entity.id);
  if(entity.type==='pull_request')return items.filter(item=>item.instruction?.entityType?.toLowerCase()==='pull_request'&&item.instruction?.entityId===entity.id);
  return [];
}

export function scopeRunsToWorkPackage<T extends {workPackageId?: string}>(runs:T[], workPackageId:string):T[]{
  return runs.filter(run=>run.workPackageId===workPackageId);
}

export function scopeOutboxToWorkPackage<T extends {report?: {workPackageId?: string}}>(items:T[], workPackageId:string):T[]{
  return items.filter(item=>item.report?.workPackageId===workPackageId);
}
