/** Use existing Chrome window; open a temporary tab, navigate, screenshot, CSS click, restore.
 * All actions run in one AppleScript transaction to avoid Chrome tab-ID churn.
 * This is user-approved interactive browser access, never auto-starts Chrome.
 */
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const [targetUrl,selector,targetFile]=process.argv.slice(2);
if(!/^https?:\/\//.test(targetUrl||'')||targetUrl.length>2048)throw Error('BROWSER_URL_DENIED');
if(!selector||typeof selector!=='string'||selector.length>500)throw Error('BROWSER_SELECTOR_DENIED');
const output=resolve(targetFile||'');
if(!output.startsWith('/tmp/byl-browser-')||!output.endsWith('.png'))throw Error('BROWSER_SCREENSHOT_PATH_DENIED');
const script=`on run argv
  set targetUrl to item 1 of argv
  set selectorJson to item 2 of argv
  set outputFile to item 3 of argv
  tell application "Google Chrome"
    set testWindow to front window
    set originalIndex to active tab index of testWindow
    set testTab to make new tab at end of tabs of testWindow with properties {URL:targetUrl}
    set active tab index of testWindow to (count of tabs of testWindow)
    activate
  end tell
  delay 2
  set resultText to "CLICK=NOT_RUN"
  try
    do shell script "/usr/sbin/screencapture -x " & quoted form of outputFile
    tell application "Google Chrome"
      set expression to "(function(){const el=document.querySelector(" & selectorJson & ");if(!el)return 'NOT_FOUND';el.click();return 'CLICKED';})()"
      set resultText to "CLICK=" & (execute testTab javascript expression)
    end tell
  on error errorText
    set resultText to "BROWSER_ACTION_ERROR=" & errorText
  end try
  tell application "Google Chrome"
    try
      close testTab
    end try
    try
      set active tab index of testWindow to originalIndex
    end try
  end tell
  return resultText
end run`;
let outputText;
try {
 outputText=execFileSync('/usr/bin/osascript',['-e',script,'--',targetUrl,JSON.stringify(selector),output],{encoding:'utf8',timeout:25000}).trim();
} catch(error){
 throw Error('CHROME_TRANSACTION_FAILED: '+String(error.stderr||error.message).slice(0,300));
}
console.log(JSON.stringify({url:targetUrl,selector,screenshot:output,result:outputText}));
if(outputText!=='CLICK=CLICKED')process.exitCode=2;
