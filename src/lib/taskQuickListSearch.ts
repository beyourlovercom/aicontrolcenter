import type {CanonicalTaskRecord} from './bridgeCore.ts';
import {taskDisplayName} from './taskPresentation.ts';

function searchableTaskFields(task:CanonicalTaskRecord):string[]{
  const scope=typeof task.entityScope==='string'?task.entityScope:'';
  return [taskDisplayName(task as {taskId:string;taskTitle?:string|null;instruction?:{title?:string}|null}),task.taskId,scope,task.workPackageId,task.formalWpId,task.formalWpTitle,task.prId,task.taskCode].filter(value=>typeof value==='string').map(value=>value.trim().toLowerCase());
}

export function filterTaskQuickList(tasks:CanonicalTaskRecord[],query:string):CanonicalTaskRecord[]{
  const needle=query.trim().toLowerCase();
  if(!needle)return tasks;
  return tasks.filter(task=>searchableTaskFields(task).some(value=>value.includes(needle)));
}
