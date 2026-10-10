import test from 'node:test';import assert from 'node:assert/strict';
import {navigateDevHome as nav} from './gui-dev-navigate.mjs';
const ready=()=>({ok:true,verified:true});const pass=()=> 'DEV_HOME_NAVIGATION_PASS pid=123 path=/';
test('bounded home navigation verifies exact receipt',()=>assert.equal(nav({windowPid:123},{inspect:ready,runner:pass}).verified,true));
test('unexpected request fields denied',()=>assert.equal(nav({windowPid:123,action:'unsafe'},{inspect:ready,runner:pass}).errorCode,'UNEXPECTED_FIELDS'));
test('reject PID zero',()=>assert.equal(nav({windowPid:0}).ok,false));
test('wrong origin prevents runner',()=>{let touched=false;const r=nav({windowPid:123},{inspect:()=>({ok:false,errorCode:'WRONG_HOST'}),runner:()=>{touched=true;return ''}});assert.equal(r.ok,false);assert.equal(touched,false)});
test('wrong receipt denied',()=>assert.equal(nav({windowPid:123},{inspect:ready,runner:()=> 'DEV_HOME_NAVIGATION_PASS pid=124 path=/'}).verified,false));
test('GUI occupied denies',()=>assert.equal(nav({windowPid:123},{lock:()=>{throw Error('GUI_BUSY')}}).errorCode,'GUI_BUSY'));
test('action errors are ambiguous and never PASS',()=>{const r=nav({windowPid:123},{inspect:ready,runner:()=>{throw Error('focus stolen')}});assert.equal(r.ok,false);assert.equal(r.executed,'unknown')});

test('native pre-click failure is confirmed not executed',()=>{
 const error=new Error('no link');error.stdout=Buffer.from('LINK_NOT_UNIQUE\n');
 const result=nav({windowPid:123},{inspect:ready,runner:()=>{throw error}});
 assert.equal(result.executed,false);assert.equal(result.errorCode,'LINK_NOT_UNIQUE');
});
test('native post-click focus loss is indeterminate',()=>{
 const error=new Error('focus');error.stdout=Buffer.from('FOCUS_STOLEN_AFTER_PRESS\n');
 const result=nav({windowPid:123},{inspect:ready,runner:()=>{throw error}});
 assert.equal(result.executed,'unknown');assert.equal(result.verified,false);
});
