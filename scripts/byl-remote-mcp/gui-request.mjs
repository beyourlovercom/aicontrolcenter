const ACTIONS=new Set(['inspect','click','type']);
export function validateGuiRequest(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return {ok:false,reason:'INVALID_REQUEST'};
 const {action,target,expectedHost,windowPid,expectedTitle}=input;
 if(!ACTIONS.has(action))return {ok:false,reason:'ACTION_DENIED'};
 if(expectedHost!=='dev.beyourlover.com')return {ok:false,reason:'DEV_ONLY_HOST_REQUIRED'};
 if(typeof expectedTitle!=='string'||!expectedTitle.startsWith('BYL GUI ')||expectedTitle.length>100)return {ok:false,reason:'ISOLATED_FIXTURE_REQUIRED'};
 if(!Number.isSafeInteger(windowPid)||windowPid<=0)return {ok:false,reason:'INVALID_PID'};
 if(action==='click'&&target!=='Click test only')return {ok:false,reason:'BUTTON_NOT_ALLOWLISTED'};
 if(action==='type'&&(target!=='GUI text test'||input.value!=='UATPASS'))return {ok:false,reason:'INPUT_NOT_ALLOWLISTED'};
 return {ok:true,mode:'DEV_ONLY',action,windowPid,expectedTitle};
}
