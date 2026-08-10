import assert from 'node:assert/strict';
import { resolveCodexExecutionPolicy } from './codexExecutionPolicy.ts';
const base={id:'AICC-X',title:'x',source:'x',rawMarkdown:'',fields:{},sections:{},status:'',goal:'',scope:'',dependencies:'',acceptanceCriteria:'',risks:'',allowed:'',forbidden:''};
assert.equal(resolveCodexExecutionPolicy(base).sandboxMode,'workspace-write');
assert.equal(resolveCodexExecutionPolicy({...base,fields:{'Execution Type':'REMEDIATION'}}).sandboxMode,'workspace-write');
assert.equal(resolveCodexExecutionPolicy({...base,fields:{'Execution Type':'READ_ONLY_AUDIT'}}).sandboxMode,'read-only');
assert.equal(resolveCodexExecutionPolicy({...base,fields:{'Execution Type':'REVIEW'}}).sandboxMode,'read-only');
console.log('codex execution policy tests passed');
