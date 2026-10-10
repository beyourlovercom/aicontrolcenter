export function verifyTransition({before,after,action}){
 if(typeof before!=='string'||typeof after!=='string')return {ok:false,reason:'STATE_UNAVAILABLE'};
 if(action==='click' && before.startsWith('BYL GUI TEST READY') && after.startsWith('BYL GUI CLICK PASS'))return {ok:true};
 if(action==='type' && before.startsWith('BYL GUI CLICK PASS') && after.startsWith('BYL GUI TYPE UATPASS'))return {ok:true};
 return {ok:false,reason:'STATE_NOT_VERIFIED'};
}
