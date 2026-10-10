import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('./gui-windows-dev-owner-uat.ps1',import.meta.url),'utf8');
test('Windows GUI UAT uses unique Chrome profile per invocation',()=>assert.match(script,/\[Guid\]::NewGuid\(\)/));
test('Windows GUI UAT uses nonblocking cross-process lock',()=>{assert.match(script,/GUI_CANARY_BUSY/);assert.match(script,/WaitOne\(0\)/);assert.match(script,/ReleaseMutex\(\)/)});
test('Windows GUI UAT polls until exact cart before a click',()=>{assert.match(script,/ADDRESS_BAR_NOT_READY/);assert.match(script,/SOURCE_CHANGED_BEFORE_CLICK/);assert.ok(script.includes('dev\.beyourlover\.com/cart'));});
test('Windows GUI UAT invokes only exact home accessibility link',()=>{assert.match(script,/BeYourLover home/);assert.match(script,/InvokePattern/);assert.match(script,/POST_CLICK_RESULT_UNKNOWN/);});
