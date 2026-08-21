export type DeliveryContextStatus='PLANNED'|'PROVISIONING'|'READY_FOR_EXECUTION'|'PR_CREATED'|'READY_FOR_UAT'|'CLOSED';
export type DeliveryContext={deliveryContextId:string;workPackageId:string;repository:string;baseBranch:string;baseSha:string;worktreePath:string;deliveryBranch:string;prNumber:number|null;prHeadSha:string|null;status:DeliveryContextStatus;createdAt:string;updatedAt:string};

export function deterministicDeliveryBranch(workPackageId:string):string{
  const safe=workPackageId.toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'');
  return `delivery/${safe}`;
}
export function deliveryContextId(workPackageId:string,baseSha:string):string{return `delivery-${workPackageId}-${baseSha.slice(0,12)}`.toLowerCase();}
export function provisionDeliveryContext(input:{workPackageId:string;repository:string;baseBranch:string;baseSha:string;worktreePath:string},existing:DeliveryContext[]=[]):DeliveryContext{
  const found=existing.find(item=>item.workPackageId===input.workPackageId&&item.status!=='CLOSED');
  if(found)return found;
  const now=new Date().toISOString();
  return {deliveryContextId:deliveryContextId(input.workPackageId,input.baseSha),workPackageId:input.workPackageId,repository:input.repository,baseBranch:input.baseBranch,baseSha:input.baseSha,worktreePath:input.worktreePath,deliveryBranch:deterministicDeliveryBranch(input.workPackageId),prNumber:null,prHeadSha:null,status:'READY_FOR_EXECUTION',createdAt:now,updatedAt:now};
}
export function bindExecutionToDeliveryContext(context:DeliveryContext){return {deliveryContextId:context.deliveryContextId,workPackageId:context.workPackageId,worktreePath:context.worktreePath,deliveryBranch:context.deliveryBranch,baseSha:context.baseSha};}
