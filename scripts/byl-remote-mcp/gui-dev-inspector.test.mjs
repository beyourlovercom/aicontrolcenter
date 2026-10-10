import test from 'node:test';import assert from 'node:assert/strict';import {inspectDevCart as inspect} from './gui-dev-inspector.mjs';
test('real Dev receipt parsed',()=>assert.equal(inspect({windowPid:123},{runner:()=> 'DEV_GUI_READONLY_IDENTITY_PASS pid=123 host=dev.beyourlover.com path=/cart'}).ok,true));
test('wrong pid denied',()=>assert.equal(inspect({windowPid:123},{runner:()=> 'DEV_GUI_READONLY_IDENTITY_PASS pid=124 host=dev.beyourlover.com path=/cart'}).ok,false));
test('wrong host denied',()=>assert.equal(inspect({windowPid:123},{runner:()=> 'DEV_GUI_READONLY_IDENTITY_PASS pid=123 host=www.beyourlover.com path=/cart'}).ok,false));
test('invalid pid denied',()=>assert.equal(inspect({windowPid:0}).errorCode,'INVALID_PID'));
test('runner fault fails closed',()=>assert.equal(inspect({windowPid:123},{runner:()=>{throw Error('FOCUS')}}).ok,false));
