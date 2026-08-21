import assert from 'node:assert/strict';
import {validateProviderGovernance} from './providerGovernance.ts';
const descriptor={provider_id:'codex',display_name:'Codex',capabilities:['implementation','review'] as ('implementation'|'review')[],status:'active' as const,version:'1'};
const context={execution_id:'g',repository:'/repo',branch:'main',worktree_path:'/tmp/w',sandbox:'workspace-write' as const,execution_type:'IMPLEMENTATION'};
assert.equal(validateProviderGovernance(descriptor,context,[{provider_id:'codex',allowed_capabilities:['implementation'],allowed_execution_types:['implementation']}]),null);
assert.equal(validateProviderGovernance(descriptor,{...context,execution_type:'REVIEW'},[{provider_id:'codex',allowed_capabilities:['implementation'],allowed_execution_types:['implementation']}])?.message,'CAPABILITY_NOT_ALLOWED: review');
assert.equal(validateProviderGovernance(descriptor,{...context,execution_type:'PR_CREATION'},[{provider_id:'codex',allowed_capabilities:['implementation'],allowed_execution_types:['implementation']}])?.message,'EXECUTION_TYPE_NOT_SUPPORTED: PR_CREATION');
console.log('provider governance matrix passed');
