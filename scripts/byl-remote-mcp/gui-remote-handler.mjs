import {execFileSync} from 'node:child_process';
import {validateGuiRequest} from './gui-request.mjs';
import {findTarget} from './gui-target.mjs';
export function handleGuiRequest(input,{runner=execFileSync,lookup=findTarget}={}){
 const gate=validateGuiRequest(input);
 if(!gate.ok)return {ok:false,errorCode:gate.reason,executed:false};
 const target=lookup(input.expectedTitle,input.windowPid);
 if(!target.ok)return {ok:false,errorCode:target.reason,executed:false};
 if(target.pid!==input.windowPid)return {ok:false,errorCode:'PID_MISMATCH',executed:false};
 if(input.action==='inspect')return {ok:true,action:'inspect',pid:target.pid,title:target.title,executed:false};
 if(input.action==='click'||input.action==='type'){
  return {ok:false,errorCode:'REMOTE_GUI_MUTATION_NOT_YET_ENABLED',executed:false};
 }
 return {ok:false,errorCode:'ACTION_DENIED',executed:false};
}
