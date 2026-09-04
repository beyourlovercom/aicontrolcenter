export const COMPOSER_RUN_BINDING_STORAGE_KEY='aicc-global-execution-composer-run-id';

export function readComposerRunBinding(storage:Storage|undefined):string|null{
  const runId=storage?.getItem(COMPOSER_RUN_BINDING_STORAGE_KEY)??null;
  return runId&&runId.trim()?runId:null;
}

export function persistComposerRunBinding(runId:string,storage:Storage|undefined):void{
  if(runId.trim())storage?.setItem(COMPOSER_RUN_BINDING_STORAGE_KEY,runId);
}
