import {execFileSync} from 'node:child_process';
const apple=(script)=>execFileSync('/usr/bin/osascript',['-e',script],{encoding:'utf8',timeout:12000}).trim();
const out={version:'GUI_PROBE_V1',mode:'READ_ONLY',timestamp:new Date().toISOString(),ok:false};
try {
 out.frontmost=apple('tell application "System Events" to get name of first application process whose frontmost is true');
 out.chromeFrontmost=apple('tell application "System Events" to get frontmost of application process "Google Chrome"');
 out.accessibilityWindowCount=Number(apple('tell application "System Events" to tell application process "Google Chrome" to get count of windows'));
 out.chromeScriptWindowCount=Number(apple('tell application "Google Chrome" to count windows'));
 if(out.chromeScriptWindowCount>0){
   try{out.chromeActiveTab=apple('tell application "Google Chrome" to get URL of active tab of front window');}
   catch(e){out.chromeActiveTabError=String(e.message).slice(0,200);}
 }
 out.ok=out.chromeFrontmost==='true' && out.chromeScriptWindowCount>0 && !!out.chromeActiveTab;
 out.actionGate=out.ok?'READ_ONLY_INSPECTION_PASS':'FAIL_CLOSED_NO_CLICK';
 console.log(JSON.stringify(out));
} catch(e) { console.error(JSON.stringify({ok:false,code:'GUI_PROBE_FAILED',message:String(e.message).slice(0,300)})); process.exitCode=1; }
