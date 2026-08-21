type TaskPresentationRecord={taskId:string;taskTitle?:string|null;instruction?:{title?:string}|null};

export function taskDisplayName(task:TaskPresentationRecord):string{
  return task.taskTitle??task.instruction?.title??task.taskId;
}

export function taskStatusIcon(status:string):string{
  const normalized=String(status??'READY').toUpperCase();
  if(normalized==='COMPLETED')return '✅';
  if(['WAITING','READY','WAITING_OWNER','STARTING','SUBMITTING'].includes(normalized))return '🟡';
  if(normalized==='RUNNING')return '⏭️';
  if(['BLOCKED','FAILED','STOPPED','CANCELLED','RECOVERY_REQUIRED'].includes(normalized))return '🔴';
  return '🟡';
}

export function taskStatusLabel(status:string):string{
  const normalized=String(status??'READY').toUpperCase();
  return ({COMPLETED:'已完成',WAITING:'等待中',WAITING_OWNER:'等待 Owner',READY:'等待执行',STARTING:'正在启动',SUBMITTING:'正在提交',RUNNING:'正在执行',BLOCKED:'当前任务已阻塞',FAILED:'执行失败',STOPPED:'执行已停止',CANCELLED:'执行已取消',RECOVERY_REQUIRED:'需要恢复'} as Record<string,string>)[normalized]??`当前状态：${normalized}`;
}

export function taskHasCanonicalResult(task:{canonicalResult?:unknown}):boolean{
  return Boolean(task.canonicalResult);
}
