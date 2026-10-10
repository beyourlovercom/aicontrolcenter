import test from 'node:test';
import assert from 'node:assert/strict';
import {moveOrClick} from './gui-control.mjs';
test('invalid actions never touch desktop',()=>assert.throws(()=>moveOrClick({action:'payment',x:1,y:1}),/INVALID_INPUT/));
test('invalid coordinates never touch desktop',()=>assert.throws(()=>moveOrClick({action:'click',x:NaN,y:1}),/INVALID_INPUT/));
test('invalid typing payload is rejected',()=>assert.throws(()=>moveOrClick({action:'type',value:'a'.repeat(121)}),/INVALID_INPUT/));
test('newline typing is rejected',()=>assert.throws(()=>moveOrClick({action:'type',value:'one\ntwo'}),/INVALID_INPUT/));
test('unsafe live desktop state fails closed',()=>assert.throws(()=>moveOrClick({action:'click',x:3,y:3}),/GUI_DENIED:(CHROME_NOT_FRONTMOST|CHROME_SCRIPT_AX_WINDOW_MISMATCH|NO_MATCHING_CHROME_WINDOW|CHROME_TAB_UNAVAILABLE|TARGET_HOST_MISMATCH)/));
