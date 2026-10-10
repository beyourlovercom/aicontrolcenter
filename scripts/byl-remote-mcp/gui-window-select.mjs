export function selectWindow(windows,{expectedTitle,expectedPid}={}){
 if(!Array.isArray(windows)||typeof expectedTitle!=='string'||expectedTitle.length<5) return {ok:false,reason:'INVALID_TARGET'};
 const matches=windows.filter(w=>w && typeof w.title==='string' && w.title.includes(expectedTitle) && Number.isInteger(w.pid) && w.pid>0 && (!expectedPid || w.pid===expectedPid));
 if(matches.length!==1)return {ok:false,reason:matches.length?'AMBIGUOUS_WINDOW':'TARGET_WINDOW_NOT_FOUND',matches:matches.length};
 const w=matches[0];return {ok:true,pid:w.pid,title:w.title,windowId:w.windowId};
}
