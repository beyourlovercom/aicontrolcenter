import type {SelectedEntityRef} from './model/entityTypes.ts';
import {scopedEntityKey} from './projectEntityScope.ts';

export type WorkPackageProjectScope=Readonly<{projectId:string;repositoryIdentity:string}>;

/** Entity detail surfaces may consume only explicitly correlated, project-scoped records. */
export function scopeInboxToEntity<T extends {projectId?:string;repositoryIdentity?:string;instruction?: {projectId?:string;repositoryIdentity?:string;workPackageId?: string; entityType?: string; entityId?: string}}>(items:T[], entity:SelectedEntityRef,scope?:WorkPackageProjectScope):T[]{
  if(entity.type==='work_package'){if(!scope?.projectId||!scope.repositoryIdentity)return [];const key=scopedEntityKey(scope,'WORK_PACKAGE',entity.id);return items.filter(item=>{const projectId=item.projectId??item.instruction?.projectId,repositoryIdentity=item.repositoryIdentity??item.instruction?.repositoryIdentity,wpId=item.instruction?.workPackageId;return typeof projectId==='string'&&typeof repositoryIdentity==='string'&&typeof wpId==='string'&&scopedEntityKey({projectId,repositoryIdentity},'WORK_PACKAGE',wpId)===key});}
  if(entity.type==='pull_request')return items.filter(item=>item.instruction?.entityType?.toLowerCase()==='pull_request'&&item.instruction?.entityId===entity.id);
  return [];
}

/** Canonical tasks use the same explicit project-scoped WP binding rules as their Inbox source. */
export function scopeTasksToEntity<T extends {projectId?:string;repositoryIdentity?:string;formalWpId?:string|null;formal_wp_id?:string|null;workPackageId?: string|null; prId?: string|null; entityScope?: string; instruction?: {projectId?:string;repositoryIdentity?:string;formalWpId?:string|null;workPackageId?: string|null; prId?: string|null; entityType?: string; entityId?: string}}>(items:T[], entity:SelectedEntityRef,scope?:WorkPackageProjectScope):T[]{
  if(entity.type==='work_package'){if(!scope?.projectId||!scope.repositoryIdentity)return [];const key=scopedEntityKey(scope,'WORK_PACKAGE',entity.id);return items.filter(item=>{const normalized='entityClass' in item||'entity_class' in item||'formalWpId' in item||'formal_wp_id' in item,wpId=normalized?(item.formalWpId??item.formal_wp_id??item.instruction?.formalWpId):(item.workPackageId??item.instruction?.workPackageId),projectId=item.projectId??item.instruction?.projectId,repositoryIdentity=item.repositoryIdentity??item.instruction?.repositoryIdentity;return typeof wpId==='string'&&typeof projectId==='string'&&typeof repositoryIdentity==='string'&&scopedEntityKey({projectId,repositoryIdentity},'WORK_PACKAGE',wpId)===key;});}
  if(entity.type==='pull_request')return items.filter(item=>(item.prId??item.instruction?.prId)===entity.id||item.instruction?.entityType?.toLowerCase()==='pull_request'&&item.instruction?.entityId===entity.id);
  return [];
}

export function scopeRunsToWorkPackage<T extends {projectId?:string;repositoryIdentity?:string;workPackageId?: string}>(runs:T[], workPackageId:string,scope?:WorkPackageProjectScope):T[]{
  if(!scope?.projectId||!scope.repositoryIdentity)return [];const key=scopedEntityKey(scope,'WORK_PACKAGE',workPackageId);return runs.filter(run=>typeof run.projectId==='string'&&typeof run.repositoryIdentity==='string'&&typeof run.workPackageId==='string'&&scopedEntityKey({projectId:run.projectId,repositoryIdentity:run.repositoryIdentity},'WORK_PACKAGE',run.workPackageId)===key);
}

export function scopeOutboxToWorkPackage<T extends {projectId?:string;repositoryIdentity?:string;report?: {projectId?:string;repositoryIdentity?:string;workPackageId?: string}}>(items:T[], workPackageId:string,scope?:WorkPackageProjectScope):T[]{
  if(!scope?.projectId||!scope.repositoryIdentity)return [];const key=scopedEntityKey(scope,'WORK_PACKAGE',workPackageId);return items.filter(item=>{const projectId=item.projectId??item.report?.projectId,repositoryIdentity=item.repositoryIdentity??item.report?.repositoryIdentity,wpId=item.report?.workPackageId;return typeof projectId==='string'&&typeof repositoryIdentity==='string'&&typeof wpId==='string'&&scopedEntityKey({projectId,repositoryIdentity},'WORK_PACKAGE',wpId)===key;});
}
