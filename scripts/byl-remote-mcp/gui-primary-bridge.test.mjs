import test from 'node:test';import assert from 'node:assert/strict';
import {guiDevCartHomeCanary,PRIMARY_GUI_TOOL_NAME} from './gui-primary-bridge.mjs';
const wrap=s=>({result:{content:[{type:'text',text:s}]}});
test('primary GUI name is fixed',()=>assert.equal(PRIMARY_GUI_TOOL_NAME,'gui_dev_cart_home_canary'));
test('successful process and receipt required',async()=>{
 let count=0;const r=await guiDevCartHomeCanary(async(device,tool,args)=>{
  assert.equal(device,'windows');count++;
  if(count===1){assert.equal(tool,'start_process');assert.match(args.command,/gui-windows-dev-owner-uat\.ps1/);return wrap('Process started with PID 4711 (shell: powershell.exe)')}
  assert.equal(tool,'read_process_output');assert.equal(args.pid,4711);
  return wrap('WINDOWS_GUI_NAVIGATION_PASS pid=4711 verified=true\nProcess completed with exit code 0');
 });assert.equal(r.verified,true);assert.equal(count,2);
});
test('receipt without exit confirmation never passes',async()=>{const r=await guiDevCartHomeCanary(async(_,tool)=>tool==='start_process'?wrap('Process started with PID 47'):wrap('WINDOWS_GUI_NAVIGATION_PASS pid=47 verified=true'));assert.equal(r.ok,false)});
test('exit success without receipt never passes',async()=>{const r=await guiDevCartHomeCanary(async(_,tool)=>tool==='start_process'?wrap('Process started with PID 47'):wrap('Process completed with exit code 0'));assert.equal(r.ok,false)});
test('process failure denied',async()=>{const r=await guiDevCartHomeCanary(async(_,tool)=>tool==='start_process'?wrap('Process started with PID 47'):wrap('Process completed with exit code 1'));assert.equal(r.ok,false)});
test('unknown outcome denied',async()=>{const r=await guiDevCartHomeCanary(async()=>{throw Error('offline')});assert.equal(r.errorCode,'GUI_OUTCOME_UNKNOWN')});
test('no arbitrary command accepted',async()=>{const r=await guiDevCartHomeCanary(null);assert.equal(r.ok,false)});
