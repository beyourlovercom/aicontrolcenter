import test from 'node:test';import assert from 'node:assert/strict';import {verifyFixtureIdentity as check} from './gui-identity.mjs';
const arg={pid:79316,title:'BYL GUI TEST READY - Google Chrome',url:'/tmp/byl-gui-owner-uat-20261010.html'};
const opts={expectedPid:79316,expectedTitle:'BYL GUI TEST READY'};
test('exact offline identity passes',()=>assert.equal(check(arg,opts).ok,true));
test('pid drift blocks',()=>assert.equal(check({...arg,pid:1},opts).reason,'PID_MISMATCH'));
test('window drift blocks',()=>assert.equal(check({...arg,title:'Checkout'},opts).reason,'WINDOW_TITLE_MISMATCH'));
test('URL drift blocks',()=>assert.equal(check({...arg,url:'https://www.beyourlover.com/'},opts).reason,'FIXTURE_URL_MISMATCH'));
test('prefix path bypass blocked',()=>assert.equal(check({...arg,url:arg.url+'.evil'},opts).reason,'FIXTURE_URL_MISMATCH'));
test('file URI accepted',()=>assert.equal(check({...arg,url:'file:///tmp/byl-gui-owner-uat-20261010.html'},opts).ok,true));
