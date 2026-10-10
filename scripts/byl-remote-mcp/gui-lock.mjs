import {openSync,closeSync,unlinkSync} from 'node:fs';
export function withGuiLock(action,{path='/tmp/byl-gui-exclusive-v1.lock'}={}){
 let fd;
 try{fd=openSync(path,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw Error('GUI_BUSY');throw e;}
 try{return action();}finally{closeSync(fd);unlinkSync(path);}
}
