export type SelfHostedMode='NORMAL_OPERATION'|'SELF_HOSTED_BOOTSTRAP'|'M8_READY';
export type M8BootstrapPolicy={bootstrap_id:string;target_phase:'M8';target_milestone:'M8';required_systems:string[];required_capabilities:string[];required_gates:string[];status:'SELF_HOSTED_BOOTSTRAP'|'M8_READY';created_at:string};
export type M8GateFacts={work_package_lifecycle:'READY'|'NOT_READY';repository_binding:'READY'|'NOT_READY';delivery_context:'AVAILABLE'|'UNAVAILABLE';execution_policy:'AVAILABLE'|'UNAVAILABLE'};
export type M8WorkPackageTemplate={milestone:'M8';origin:'ROADMAP';repository_required:true;provider_required:true;delivery_required:true;execution_policy_required:true};
export const M8_REQUIRED_SYSTEMS=['WP Lifecycle','Repository Registry','Scheduler','Provider Intelligence','Execution Policy','Delivery Governance'];
export const M8_REQUIRED_GATES=['WORK_PACKAGE_LIFECYCLE','REPOSITORY_BINDING','DELIVERY_CONTEXT','EXECUTION_POLICY'];
export function createM8BootstrapPolicy(now=new Date().toISOString(),ready=false):M8BootstrapPolicy{return {bootstrap_id:'m8-bootstrap-001',target_phase:'M8',target_milestone:'M8',required_systems:[...M8_REQUIRED_SYSTEMS],required_capabilities:[...M8_REQUIRED_SYSTEMS],required_gates:[...M8_REQUIRED_GATES],status:ready?'M8_READY':'SELF_HOSTED_BOOTSTRAP',created_at:now}}
export function evaluateM8Gate(facts:M8GateFacts){const missing=(Object.entries(facts) as [keyof M8GateFacts,string][]).filter(([,value])=>value!=='READY'&&value!=='AVAILABLE').map(([key])=>key.toUpperCase());return {ready:missing.length===0,missing_gates:missing,canCreate:missing.length===0}}
export function createM8Template():M8WorkPackageTemplate{return {milestone:'M8',origin:'ROADMAP',repository_required:true,provider_required:true,delivery_required:true,execution_policy_required:true}}
export function selfHostedMode(ready:boolean,bootstrapActive=true):SelfHostedMode{return ready?'M8_READY':bootstrapActive?'SELF_HOSTED_BOOTSTRAP':'NORMAL_OPERATION'}
export function checkM8Readiness(facts:M8GateFacts){const gate=evaluateM8Gate(facts);return {status:gate.ready?'READY':'NOT_READY',missing:gate.missing_gates} as const}
export function m8WorkPackageGate(facts:M8GateFacts){const readiness=checkM8Readiness(facts);return {allowed:readiness.status==='READY',status:readiness.status,missing_requirements:readiness.missing}}
export function executionPath(){return ['WORK_PACKAGE_LIFECYCLE','DELIVERY_CONTEXT','EXECUTION_POLICY','PROVIDER_REGISTRY','RUNTIME'] as const}
export function governanceBoundary(){return {canCreate:true,canPrepareDelivery:true,canSchedule:true,canApproveSelf:false,canMergeSelf:false,canReleaseSelf:false}}
