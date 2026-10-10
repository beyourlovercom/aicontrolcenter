import {execFileSync} from 'node:child_process';
import {validateGuiRequest} from './gui-request.mjs';
import {findTarget} from './gui-target.mjs';
import {verifyFixtureIdentity} from './gui-identity.mjs';
import {withGuiLock} from './gui-lock.mjs';
export function handleGuiRequest(input,{runner=execFileSync,lookup=findTarget,lock=withGuiLock}={}){
 const gate=validateGuiRequest(input);
 if(!gate.ok)return {ok:false,errorCode:gate.reason,executed:false};
 return lock(()=>executeValidatedRequest(input,{lookup,runner}));
}
function executeValidatedRequest(input,{lookup,runner}){
 const target=lookup(input.expectedTitle,input.windowPid);
 if(!target.ok)return {ok:false,errorCode:target.reason,executed:false};
 const identity=verifyFixtureIdentity(target,{expectedPid:input.windowPid,expectedTitle:input.expectedTitle});
 if(!identity.ok)return {ok:false,errorCode:identity.reason,executed:false};
 if(input.action==='inspect')return {ok:true,action:'inspect',pid:target.pid,title:target.title,executed:false};
 if(input.action==='click'||input.action==='type'){
  try {
   const output=runner('/usr/bin/swift',[new URL('./gui-fixture-action.swift',import.meta.url).pathname,String(input.windowPid),input.action],{encoding:'utf8',timeout:30000});
   return {ok:output.includes('GUI_FIXTURE_ACTION_PASS'),action:input.action,executed:true,verified:output.includes('GUI_FIXTURE_ACTION_PASS'),errorCode:output.includes('GUI_FIXTURE_ACTION_PASS')?undefined:'RESULT_NOT_VERIFIED'};
  }catch{return {ok:false,errorCode:'GUI_ACTION_FAILED_CLOSED',executed:'unknown',verified:false};}
 }
 return {ok:false,errorCode:'ACTION_DENIED',executed:false};
}
