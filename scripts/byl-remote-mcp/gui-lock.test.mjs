import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {withGuiLock} from './gui-lock.mjs';
test('exclusive lock refuses reentrant action and cleans up',()=>{
 const d=mkdtempSync(join(tmpdir(),'byl-gui-lock-'));const path=join(d,'gui.lock');
 try{assert.equal(withGuiLock(()=>{assert.throws(()=>withGuiLock(()=>{throw Error('must not execute')},{path}),/GUI_BUSY/);return 7},{path}),7);
 assert.throws(()=>withGuiLock(()=>{throw Error('INTENTIONAL_FAILURE')},{path}),/INTENTIONAL_FAILURE/);
 assert.equal(withGuiLock(()=>42,{path}),42);}finally{rmSync(d,{recursive:true,force:true});}
});
