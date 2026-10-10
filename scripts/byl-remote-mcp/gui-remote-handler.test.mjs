import test from 'node:test';import assert from 'node:assert/strict';import {handleGuiRequest} from './gui-remote-handler.mjs';
const req={action:'inspect',windowPid:123,expectedHost:'dev.beyourlover.com',expectedTitle:'BYL GUI TEST READY'};
const lookup=()=>({ok:true,pid:123,title:'BYL GUI TEST READY - Google Chrome',url:'/tmp/byl-gui-owner-uat-20261010.html'});
test('remote inspect adapter finds bound window',()=>assert.equal(handleGuiRequest(req,{lookup}).ok,true));
test('wrong PID blocks',()=>assert.equal(handleGuiRequest(req,{lookup:()=>({ok:true,pid:456,title:'BYL GUI TEST READY',url:'/tmp/byl-gui-owner-uat-20261010.html'})}).errorCode,'PID_MISMATCH'));
test('missing URL proof blocks',()=>assert.equal(handleGuiRequest(req,{lookup:()=>({ok:true,pid:123,title:'BYL GUI TEST READY - Google Chrome'})}).errorCode,'FIXTURE_URL_MISMATCH'));
test('missing target blocks',()=>assert.equal(handleGuiRequest(req,{lookup:()=>({ok:false,reason:'TARGET_WINDOW_NOT_FOUND'})}).errorCode,'TARGET_WINDOW_NOT_FOUND'));
test('unsafe request blocks before window lookup',()=>assert.equal(handleGuiRequest({...req,expectedHost:'www.beyourlover.com'},{lookup:()=>{throw Error('should not run')}}).errorCode,'DEV_ONLY_HOST_REQUIRED'));
test('mutation remains disabled until target verification integrated',()=>assert.equal(handleGuiRequest({...req,action:'click',target:'Click test only'},{lookup}).errorCode,'REMOTE_GUI_MUTATION_NOT_YET_ENABLED'));
