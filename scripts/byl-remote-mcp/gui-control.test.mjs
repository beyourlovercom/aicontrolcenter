import test from 'node:test';
import assert from 'node:assert/strict';
import {moveOrClick} from './gui-control.mjs';
test('invalid actions never touch desktop',()=>assert.throws(()=>moveOrClick({action:'payment',x:1,y:1}),/INVALID_INPUT/));
test('invalid coordinates never touch desktop',()=>assert.throws(()=>moveOrClick({action:'click',x:NaN,y:1}),/INVALID_INPUT/));
test('invalid typing payload is rejected',()=>assert.throws(()=>moveOrClick({action:'type',value:'a'.repeat(121)}),/INVALID_INPUT/));
test('newline typing is rejected',()=>assert.throws(()=>moveOrClick({action:'type',value:'one\ntwo'}),/INVALID_INPUT/));
test('denied action is deterministic without live desktop',()=>assert.throws(()=>moveOrClick({action:'pay',x:3,y:3}),/INVALID_INPUT/));
