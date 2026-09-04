export const COMPOSER_DRAFT_STORAGE_KEY='aicc-global-execution-composer-draft';

export function readComposerDraft(storage:Storage|undefined):string{
  return storage?.getItem(COMPOSER_DRAFT_STORAGE_KEY)??'';
}

export function persistComposerDraft(value:string,storage:Storage|undefined):void{
  if(!storage)return;
  if(value)storage.setItem(COMPOSER_DRAFT_STORAGE_KEY,value);
  else storage.removeItem(COMPOSER_DRAFT_STORAGE_KEY);
}
