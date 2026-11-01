/**
 * V3 DC intent preflight. NOT an authorization provider or a dispatcher.
 * Owner-supplied booleans cannot prove authority. All resulting intents STOP
 * until independent persisted authorization and a trusted adapter exist.
 */
export const DC_PRIMARY_ID='SELF_HOSTED_DC';
export const DC_CANONICAL_DEVICES=Object.freeze(['us-macmini','china-mac','windows','007windows']);
export const DC_READ_ONLY_OPERATIONS=Object.freeze(['remote_list_devices','remote_list_tools','remote_process_selftest']);
export const DC_APPROVED_DEV_SCOPE=Object.freeze({
 workPackageId:'AICC-EXECUTOR-DC-PRIMARY-V3',
 repositoryIdentity:'beyourlovercom/aicontrolcenter',
 mainSha:'69c8a7816d3a75a50b40eab11c8123eda0ae2e4a',
 branch:'feat/aicc-executor-dc-primary-v3-20261101'
});
const SHA=/^[0-9a-f]{40}$/i;
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
export function assessDcSupervisedIntent(input={}){
 if(input?.provider==='CLAUDE_CODE')fail('DC_V3_CLAUDE_RETIRED');
 if(input?.provider!==DC_PRIMARY_ID)fail('DC_V3_PROVIDER_INVALID');
 if(!['CODE_CHANGE','TEST_ONLY'].includes(input.executionClass))fail('DC_V3_CLASS_INVALID');
 for(const field of ['workPackageId','repositoryIdentity','mainSha','branch'])
  if(input[field]!==DC_APPROVED_DEV_SCOPE[field])fail('DC_V3_SCOPE_MISMATCH');
 if(!SHA.test(input.expectedHead||'')||!SHA.test(input.actualMainSha||'')||
    !SHA.test(input.actualHead||'')||input.mainSha!==input.actualMainSha||
    input.expectedHead!==input.actualHead||input.branch!==input.actualBranch)
  fail('DC_V3_AUTHORITY_DRIFT');
 if(!DC_CANONICAL_DEVICES.includes(input.deviceId))
  fail('DC_V3_DEVICE_NOT_ALLOWLISTED');
 if(input.platformDenied===true)fail('DC_V3_PLATFORM_DENIED');
 if(input.authenticatedFormalOAuth!==true)fail('DC_V3_FORMAL_OAUTH_REQUIRED');
 // Neither ownerApproved:true nor caller-supplied identity are proof of an
 // independently attested, persisted Owner authorization.
 return Object.freeze({
  provider:DC_PRIMARY_ID,workPackageId:DC_APPROVED_DEV_SCOPE.workPackageId,
  repositoryIdentity:DC_APPROVED_DEV_SCOPE.repositoryIdentity,
  mainSha:DC_APPROVED_DEV_SCOPE.mainSha,branch:DC_APPROVED_DEV_SCOPE.branch,
  deviceId:input.deviceId,executionClass:input.executionClass,
  decision:'STOP_GATE',reason:'DC_V3_INDEPENDENT_OWNER_ATTESTATION_REQUIRED',
  automaticDispatchAllowed:false,independentAuthorization:'NOT_ATTESTED'
 });
}
export function validateDcTypedReadIntent({op,deviceId,arguments:args}={}){
 if(!DC_READ_ONLY_OPERATIONS.includes(op))fail('DC_V3_TOOL_NOT_ALLOWLISTED');
 if(op==='remote_list_devices'){
  if(deviceId!==undefined||args!==undefined)fail('DC_V3_ARGUMENTS_INVALID');
  return Object.freeze({op});
 }
 if(!DC_CANONICAL_DEVICES.includes(deviceId))fail('DC_V3_DEVICE_NOT_ALLOWLISTED');
 if(args!==undefined&&(args===null||typeof args!=='object'||Array.isArray(args)||
     Object.keys(args).length!==0))fail('DC_V3_ARGUMENTS_INVALID');
 return Object.freeze({op,deviceId});
}
export function assertDcAutomaticDispatchAllowed(){
 fail('DC_AUTO_DISPATCH_NOT_AUTHORIZED');
}
