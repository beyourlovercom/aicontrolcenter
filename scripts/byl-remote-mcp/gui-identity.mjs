export function verifyFixtureIdentity({pid,title,url},{expectedPid,expectedTitle,expectedPath='/tmp/byl-gui-owner-uat-20261010.html'}={}){
 if(!Number.isSafeInteger(pid)||pid!==expectedPid)return {ok:false,reason:'PID_MISMATCH'};
 if(typeof title!=='string'||!title.startsWith(expectedTitle))return {ok:false,reason:'WINDOW_TITLE_MISMATCH'};
 const normalized=typeof url==='string'&&url.startsWith('file://')?decodeURIComponent(url.slice(7)):url;
 if(normalized!==expectedPath)return {ok:false,reason:'FIXTURE_URL_MISMATCH'};
 return {ok:true,reason:'ISOLATED_TARGET_BOUND'};
}
