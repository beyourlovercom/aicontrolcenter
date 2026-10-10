import {execFileSync} from 'node:child_process';
import {inspectBoundDevWindow} from './gui-bound-dev.mjs';
import {withGuiLock} from './gui-lock.mjs';
export function navigateDevHome(input,{inspect=inspectBoundDevWindow,runner=execFileSync,lock=withGuiLock}={}){
 const {windowPid}=input||{};
 if(!input||Object.keys(input).some(key=>key!=='windowPid'))return {ok:false,errorCode:'UNEXPECTED_FIELDS',executed:false};
 if(!Number.isSafeInteger(windowPid)||windowPid<=0)return {ok:false,errorCode:'INVALID_PID',executed:false};
 try{return lock(()=>{
  const source=inspect({windowPid});
  if(!source.ok)return {...source,executed:false,verified:false};
  try{
   const result=runner('/usr/bin/swift',[new URL('./gui-dev-navigation.swift',import.meta.url).pathname,String(windowPid)],{encoding:'utf8',timeout:30000});
   const verified=result.trim()==='DEV_HOME_NAVIGATION_PASS pid='+windowPid+' path=/';
   return {ok:verified,action:'navigate_dev_home',windowPid,executed:true,verified,errorCode:verified?undefined:'NAVIGATION_NOT_VERIFIED'};
  }catch{return {ok:false,errorCode:'NAVIGATION_OUTCOME_UNKNOWN',executed:'unknown',verified:false};}
 });}catch(error){return {ok:false,errorCode:error?.message==='GUI_BUSY'?'GUI_BUSY':'GUI_LOCK_ERROR',executed:false};}
}
