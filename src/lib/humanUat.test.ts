import assert from 'node:assert/strict';
import {canPassHumanUat,resolveHumanUatStatus} from './humanUat.ts';
const pass=[{id:'1',title:'a',description:'a',state:'PASS' as const},{id:'2',title:'b',description:'b',state:'N_A' as const}];
assert.equal(canPassHumanUat(pass),true);assert.equal(resolveHumanUatStatus(null,pass),'IN_PROGRESS');
assert.equal(canPassHumanUat([{...pass[0],state:'PENDING'}]),false);assert.equal(canPassHumanUat([{...pass[0],state:'FAIL'}]),false);
assert.equal(resolveHumanUatStatus({repository:'r',workPackageId:'w',entityType:'work_package',status:'PASS',items:pass,createdAt:'',updatedAt:'',source:''},pass),'PASS');
console.log('human UAT contract tests passed');
