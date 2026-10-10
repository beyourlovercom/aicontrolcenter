export function guiActionGate({frontmost,chromeFrontmost,accessibilityWindowCount,chromeScriptWindowCount,chromeActiveTab,expectedHost}) {
 if(frontmost!=='Google Chrome'||chromeFrontmost!=='true')return {ok:false,reason:'CHROME_NOT_FRONTMOST'};
 if(accessibilityWindowCount>0 && chromeScriptWindowCount===0)return {ok:false,reason:'CHROME_SCRIPT_AX_WINDOW_MISMATCH'};
 if(accessibilityWindowCount<1||chromeScriptWindowCount<1)return {ok:false,reason:'NO_MATCHING_CHROME_WINDOW'};
 if(!chromeActiveTab)return {ok:false,reason:'CHROME_TAB_UNAVAILABLE'};
 let url;try{url=new URL(chromeActiveTab);}catch{return {ok:false,reason:'INVALID_TAB_URL'};}
 if(url.protocol!=='https:'||url.hostname!==expectedHost)return {ok:false,reason:'TARGET_HOST_MISMATCH'};
 return {ok:true,reason:'TARGET_VERIFIED'};
}
