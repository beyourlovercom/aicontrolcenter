export type ExecutionEntityScope='GLOBAL_TASK'|'WORK_PACKAGE'|'PULL_REQUEST';
export type ConfirmedExecutionContext={type:'work_package'|'pull_request';id:string};
export type ExecutionContextRoute={scope:ExecutionEntityScope;entityType:'global_task'|'work_package'|'pull_request';entityId:string;workPackageId:string|null;prId:string|null;displayBinding:'GLOBAL / UNMAPPED'|'WORK_PACKAGE'|'PULL_REQUEST'};

export function routeExecutionContext(input:{declared?:ConfirmedExecutionContext|null;confirmed?:ConfirmedExecutionContext|null}):ExecutionContextRoute{
  const context=input.declared??input.confirmed??null;
  if(context?.type==='work_package')return {scope:'WORK_PACKAGE',entityType:'work_package',entityId:context.id,workPackageId:context.id,prId:null,displayBinding:'WORK_PACKAGE'};
  if(context?.type==='pull_request')return {scope:'PULL_REQUEST',entityType:'pull_request',entityId:context.id,workPackageId:null,prId:context.id,displayBinding:'PULL_REQUEST'};
  return {scope:'GLOBAL_TASK',entityType:'global_task',entityId:'GLOBAL_TASK',workPackageId:null,prId:null,displayBinding:'GLOBAL / UNMAPPED'};
}
