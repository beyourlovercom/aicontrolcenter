/**
 * P6-H browser actions on the existing user Chrome (macOS only).
 * No Chrome launch/restart and no remote debugging port. Always use a dedicated
 * tab identified by a URL marker, not the user's currently active tab.
 *
 * Usage:
 * node browser-operator.mjs create https://example.com/
 * node browser-operator.mjs navigate <tabId> https://example.com/
 * node browser-operator.mjs screenshot <tabId> /tmp/byl-browser-uat.png
 * node browser-operator.mjs click <tabId> <css-selector>
 * node browser-operator.mjs close <tabId>
 *
 * The actual Google Chrome Apple Events JavaScript feature may be disabled
 * by user configuration: fail closed and report BROWSER_JAVASCRIPT_DISABLED.
 */
import {execFileSync} from 'node:child_process';
import {realpathSync} from 'node:fs';
import {resolve} from 'node:path';

const [action,first,second]=process.argv.slice(2);
const allowed=new Set(['create','navigate','screenshot','click','close']);
if(!allowed.has(action))throw Error('BROWSER_ACTION_DENIED');
function shellApple(script,...args){
  try{
    return execFileSync('/usr/bin/osascript',['-e',script,'--',...args],{encoding:'utf8',timeout:15000}).trim();
  }catch(error){
    throw Error('CHROME_AUTOMATION_FAILED: '+String(error.stderr||error.message).slice(0,300));
  }
}
function tabId(value){
  if(!/^\d{1,12}$/.test(String(value||'')))throw Error('BROWSER_TAB_ID_INVALID');
  return String(value);
}
function url(value){
  if(typeof value!=='string'||value.length>2048||!/^https?:\/\//.test(value))
    throw Error('BROWSER_URL_INVALID');
  return value;
}
function checkTab(id){
  const script=`on run argv
  set targetId to item 1 of argv
  tell application "Google Chrome"
    repeat with w in windows
      repeat with t in tabs of w
        if ((id of t) as text) = targetId then
          return URL of t
        end if
      end repeat
    end repeat
  end tell
  error "BROWSER_TAB_NOT_FOUND"
end run`;
  return shellApple(script,id);
}
if(action==='create'){
  const dest=url(first);
  const script=`on run argv
  tell application "Google Chrome"
    tell front window
      set t to make new tab with properties {URL:(item 1 of argv)}
      return id of t as string
    end tell
  end tell
end run`;
  console.log(JSON.stringify({tabId:shellApple(script,dest),url:dest}));
}else if(action==='navigate'){
  const id=tabId(first);const dest=url(second);
  checkTab(id);
  const script=`on run argv
  set targetId to item 1 of argv
  tell application "Google Chrome"
    repeat with w in windows
      repeat with t in tabs of w
        if ((id of t) as text) = targetId then
          set URL of t to item 2 of argv
          return URL of t
        end if
      end repeat
    end repeat
  end tell
  error "BROWSER_TAB_NOT_FOUND"
end run`;
  console.log(JSON.stringify({url:shellApple(script,id,dest),tabId:id}));
}else if(action==='screenshot'){
  const id=tabId(first);
  const target=resolve(second||'');
  if(!target.startsWith('/tmp/byl-browser-')||!target.endsWith('.png'))
    throw Error('BROWSER_SCREENSHOT_PATH_DENIED');
  checkTab(id);
  const activate=`on run argv
  set targetId to item 1 of argv
  tell application "Google Chrome"
    repeat with w in windows
      repeat with t in tabs of w
        if ((id of t) as text) = targetId then
          set tabIndex to (get index of t)
          set active tab index of w to tabIndex
          set index of w to 1
          activate
          return "READY"
        end if
      end repeat
    end repeat
  end tell
  error "BROWSER_TAB_NOT_FOUND"
end run`;
  shellApple(activate,id);
  execFileSync('/usr/sbin/screencapture',['-x',target],{timeout:15000});
  console.log(JSON.stringify({tabId:id,screenshot:target}));
}else if(action==='click'){
  const id=tabId(first); const selector=second||'';
  if(!selector||selector.length>500)throw Error('BROWSER_SELECTOR_INVALID');
  checkTab(id);
  const script=`on run argv
  set targetId to item 1 of argv
  set query to item 2 of argv
  tell application "Google Chrome"
    repeat with w in windows
      repeat with t in tabs of w
        if ((id of t) as text) = targetId then
          set js to "(function(){const el=document.querySelector(" & query & ");if(!el)return 'NOT_FOUND';el.click();return 'CLICKED';})()"
          return execute t javascript js
        end if
      end repeat
    end repeat
  end tell
  error "BROWSER_TAB_NOT_FOUND"
end run`;
  console.log(JSON.stringify({tabId:id,result:shellApple(script,id,JSON.stringify(selector))}));
}else if(action==='close'){
  const id=tabId(first);
  checkTab(id);
  const script=`on run argv
  set targetId to item 1 of argv
  tell application "Google Chrome"
    repeat with w in windows
      repeat with t in tabs of w
        if ((id of t) as text) = targetId then
          close t
          return "CLOSED"
        end if
      end repeat
    end repeat
  end tell
  error "BROWSER_TAB_NOT_FOUND"
end run`;
  console.log(JSON.stringify({tabId:id,result:shellApple(script,id)}));
}
