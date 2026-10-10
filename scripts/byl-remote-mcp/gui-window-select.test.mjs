import test from 'node:test';import assert from 'node:assert/strict';import {selectWindow} from './gui-window-select.mjs';
const ws=[{pid:123,title:'Your Cart – BeYourLover®',windowId:1},{pid:456,title:'Windows Backup MCP - Google Chrome',windowId:2}];
test('unique title selects correct PID',()=>assert.equal(selectWindow(ws,{expectedTitle:'Your Cart'}).pid,123));
test('duplicate title blocks',()=>assert.equal(selectWindow([...ws,{pid:789,title:ws[0].title}],{expectedTitle:'Your Cart'}).reason,'AMBIGUOUS_WINDOW'));
test('missing target blocks',()=>assert.equal(selectWindow(ws,{expectedTitle:'Checkout Page'}).reason,'TARGET_WINDOW_NOT_FOUND'));
test('invalid title blocks',()=>assert.equal(selectWindow(ws,{expectedTitle:''}).reason,'INVALID_TARGET'));
test('PID mismatch blocks',()=>assert.equal(selectWindow(ws,{expectedTitle:'Your Cart',expectedPid:456}).reason,'TARGET_WINDOW_NOT_FOUND'));
