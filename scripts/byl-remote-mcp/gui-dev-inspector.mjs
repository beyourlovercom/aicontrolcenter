import {execFileSync} from 'node:child_process';
export function inspectDevCart({windowPid},{runner=execFileSync}={}){
 if(!Number.isSafeInteger(windowPid)||windowPid<=0)return {ok:false,errorCode:'INVALID_PID',executed:false};
 try {
  const output=runner('/usr/bin/swift',[new URL('./gui-dev-identity.swift',import.meta.url).pathname,String(windowPid)],{encoding:'utf8',timeout:20000});
  const match=/^DEV_GUI_READONLY_IDENTITY_PASS pid=(\d+) host=dev\.beyourlover\.com path=(\/cart\/?$)/m.exec(output);
  if(!match||Number(match[1])!==windowPid)return {ok:false,errorCode:'DEV_IDENTITY_NOT_VERIFIED',executed:false};
  return {ok:true,action:'inspect_dev_cart',pid:windowPid,host:'dev.beyourlover.com',path:match[2],executed:false,verified:true};
 }catch{return {ok:false,errorCode:'DEV_IDENTITY_CHECK_FAILED',executed:false};}
}
