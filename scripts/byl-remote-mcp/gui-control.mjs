import {execFileSync} from 'node:child_process';
import {mkdirSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {guiActionGate} from './gui-gate.mjs';
const lock='/tmp/byl-gui-control.lock';
const apple=s=>execFileSync('/usr/bin/osascript',['-e',s],{encoding:'utf8',timeout:10000}).trim();
function state(){
 const frontmost=apple('tell application "System Events" to get name of first application process whose frontmost is true');
 const chromeFrontmost=apple('tell application "System Events" to get frontmost of application process "Google Chrome"');
 const accessibilityWindowCount=Number(apple('tell application "System Events" to tell application process "Google Chrome" to count windows'));
 const chromeScriptWindowCount=Number(apple('tell application "Google Chrome" to count windows'));
 const chromeActiveTab=chromeScriptWindowCount?apple('tell application "Google Chrome" to get URL of active tab of front window'):'';
 return {frontmost,chromeFrontmost,accessibilityWindowCount,chromeScriptWindowCount,chromeActiveTab};
}
export function inspect(expectedHost){const s=state();return {...s,gate:guiActionGate({...s,expectedHost})};}
export function moveOrClick({action,x,y,value,expectedHost='dev.beyourlover.com'}){
 if(!['move','click','type'].includes(action))throw Error('INVALID_INPUT');
 if(action==='type' && (typeof value!=='string'||value.length>120||/[\r\n]/.test(value)))throw Error('INVALID_INPUT');
 if(action!=='type' && (![x,y].every(Number.isFinite)))throw Error('INVALID_INPUT');
 let fd;try{fd=openSync(lock,'wx',0o600);}catch{throw Error('GUI_LOCK_HELD');}
 try{
  const before=inspect(expectedHost);
  if(!before.gate.ok)throw Error('GUI_DENIED:'+before.gate.reason);
  const screenshot='/tmp/byl-gui-before-'+process.pid+'.png';
  execFileSync('/usr/sbin/screencapture',['-x',screenshot],{timeout:15000});
  execFileSync('/usr/bin/swift',[join(import.meta.dirname,'gui-input.swift'),action,...(action==='type'?[value]:[String(x),String(y)])],{timeout:30000});
  const afterShot='/tmp/byl-gui-after-'+process.pid+'.png';
  execFileSync('/usr/sbin/screencapture',['-x',afterShot],{timeout:15000});
  const after=inspect(expectedHost);
  const result={eventSent:true,verified:false,action,before:before.chromeActiveTab,after:after.chromeActiveTab,gateAfter:after.gate.reason,beforeScreenshot:screenshot,afterScreenshot:afterShot};
  return result;
 }finally{closeSync(fd);unlinkSync(lock);}
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 const [action,x,y,host]=process.argv.slice(2);
 if(action==='inspect')console.log(JSON.stringify(inspect(host||'dev.beyourlover.com')));
 else if(action==='type')throw Error('TYPING_REQUIRES_CONTROLLED_API');
 else console.log(JSON.stringify(moveOrClick({action,x:Number(x),y:Number(y),expectedHost:host})));
}
