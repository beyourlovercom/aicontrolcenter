import {execFileSync} from 'node:child_process';
const SAFE_PROFILE=/(?:^|\s)--user-data-dir=(\/tmp\/byl-gui-[A-Za-z0-9_-]+)(?=\s|$)/;
export function verifyIsolatedChromeProcess(pid,{ps=execFileSync}={}){
 if(!Number.isSafeInteger(pid)||pid<=0)return {ok:false,errorCode:'INVALID_PID'};
 try {
  const command=ps('/bin/ps',['-p',String(pid),'-o','command='],{encoding:'utf8',timeout:5000}).trim();
  const profile=SAFE_PROFILE.exec(command)?.[1];
  if(!command.includes('Google Chrome.app/Contents/MacOS/Google Chrome')||!command.includes('--force-renderer-accessibility')||!profile)return {ok:false,errorCode:'ISOLATED_CHROME_PROFILE_REQUIRED'};
  return {ok:true,profile};
 }catch{return {ok:false,errorCode:'CHROME_PROCESS_NOT_FOUND'};}
}
export function checkDevSnapshot(snapshot,pid){
 if(snapshot?.pid!==pid||!Array.isArray(snapshot.windows))return {ok:false,errorCode:'AX_SNAPSHOT_INVALID'};
 const matches=[];
 for(const window of snapshot.windows){
  if(window?.addressBarCount!=='1'||typeof window?.url!=='string')continue;
  const address=window.url.startsWith('https://')?window.url:'https://'+window.url;
  let parsed;try{parsed=new URL(address);}catch{continue;}
  if(parsed.protocol==='https:'&&parsed.hostname==='dev.beyourlover.com'&&['/cart','/cart/'].includes(parsed.pathname)&&!parsed.username&&!parsed.password&&!parsed.search&&!parsed.hash)matches.push(window);
 }
 if(matches.length!==1)return {ok:false,errorCode:matches.length>1?'AX_WINDOW_AMBIGUOUS':'DEV_CART_WINDOW_NOT_VERIFIED'};
 return {ok:true,windowTitle:matches[0].title,host:'dev.beyourlover.com',path:'/cart',pid};
}
export function inspectBoundDevWindow({windowPid},{ps=execFileSync,swift=execFileSync}={}){
 const process=verifyIsolatedChromeProcess(windowPid,{ps});
 if(!process.ok)return process;
 try{
  const raw=swift('/usr/bin/swift',[new URL('./gui-window-snapshot.swift',import.meta.url).pathname,String(windowPid)],{encoding:'utf8',timeout:20000});
  const identity=checkDevSnapshot(JSON.parse(raw),windowPid);
  return identity.ok?{...identity,profile:process.profile,verified:true,executed:false}:identity;
 }catch{return {ok:false,errorCode:'AX_SNAPSHOT_FAILED'};}
}
