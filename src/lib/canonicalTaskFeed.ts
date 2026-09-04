export type CanonicalTaskFeedSource='CLIPBOARD'|'CLIPBOARD_DIRECT'|'WEB_BRIDGE'|'GPT_BLOCK'|'GPT_AUTO_CONTROL_LOOP';

export type CanonicalTaskFeedRow={
  taskId:string;
  title:string;
  status:string;
  canonicalSource:string;
  sourceLabel:string;
  activityAt:string|null;
  bindingLabel:string;
  task:Record<string,any>;
};

const sourceLabels:Record<CanonicalTaskFeedSource,string>={
  CLIPBOARD:'手动',
  CLIPBOARD_DIRECT:'AICC Bridge',
  WEB_BRIDGE:'AICC Bridge',
  GPT_BLOCK:'GPT Plus',
  GPT_AUTO_CONTROL_LOOP:'GPT Plus'
};

export function canonicalTaskSourceLabel(source:unknown):string{
  const canonical=typeof source==='string'&&source.trim()?source.trim():'UNKNOWN';
  return canonical in sourceLabels?sourceLabels[canonical as CanonicalTaskFeedSource]:`未知来源 · ${canonical}`;
}

function canonicalActivityAt(task:Record<string,any>):string|null{
  for(const value of [task.updatedAt,task.completedAt,task.startedAt,task.createdAt]){
    if(typeof value==='string'&&value.trim())return value;
  }
  return null;
}

function activityTime(value:string|null):number{
  const parsed=value?Date.parse(value):Number.NaN;
  return Number.isFinite(parsed)?parsed:Number.NEGATIVE_INFINITY;
}

function canonicalBindingLabel(task:Record<string,any>):string{
  const milestone=task.milestoneId??task.milestone_id??task.instruction?.milestoneId??null;
  const workPackage=task.formalWpId??task.formal_wp_id??task.instruction?.formalWpId??task.workPackageId??task.instruction?.workPackageId??null;
  const pullRequest=task.prId??task.instruction?.prId??null;
  const values=[milestone,workPackage,pullRequest?`PR ${pullRequest}`:null].filter((value):value is string=>typeof value==='string'&&Boolean(value.trim()));
  if(values.length)return values.join(' / ');
  return task.entityScope==='GLOBAL_TASK'?'GLOBAL / UNMAPPED':'UNKNOWN / UNMAPPED';
}

function projectTask(task:Record<string,any>):CanonicalTaskFeedRow|null{
  const taskId=typeof task?.taskId==='string'?task.taskId.trim():'';
  if(!taskId)return null;
  const canonicalSource=typeof (task.origin_source??task.origin)==='string'&&String(task.origin_source??task.origin).trim()?String(task.origin_source??task.origin).trim():'UNKNOWN';
  return {
    taskId,
    title:String(task.taskTitle??task.taskCode??task.instruction?.taskTitle??task.instruction?.taskCode??task.instructionId??taskId),
    status:String(task.status??'UNKNOWN'),
    canonicalSource,
    sourceLabel:canonicalTaskSourceLabel(canonicalSource),
    activityAt:canonicalActivityAt(task),
    bindingLabel:canonicalBindingLabel(task),
    task
  };
}

export function projectCanonicalTaskFeed(tasks:readonly Record<string,any>[]):CanonicalTaskFeedRow[]{
  const canonicalById=new Map<string,CanonicalTaskFeedRow>();
  for(const task of tasks){
    const row=projectTask(task);
    if(!row)continue;
    const existing=canonicalById.get(row.taskId);
    if(!existing||activityTime(row.activityAt)>activityTime(existing.activityAt))canonicalById.set(row.taskId,row);
  }
  return [...canonicalById.values()].sort((left,right)=>activityTime(right.activityAt)-activityTime(left.activityAt)||left.taskId.localeCompare(right.taskId));
}
