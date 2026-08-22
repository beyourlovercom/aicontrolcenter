import {realpathSync} from 'node:fs';

export function canonicalFilesystemPath(value:string):string|null{
  if(!value)return null;
  try{return realpathSync.native(value)}catch{return null}
}

export function sameCanonicalPath(left:string|undefined|null,right:string|undefined|null):boolean{
  if(!left||!right)return false;
  const a=canonicalFilesystemPath(left),b=canonicalFilesystemPath(right);
  return Boolean(a&&b&&a===b);
}
