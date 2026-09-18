(()=>{
  'use strict';
  if(globalThis.__AICC_PAGE_WAKE_V1__)return;globalThis.__AICC_PAGE_WAKE_V1__=true;
  window.addEventListener('message',event=>{
    if(event.source!==window||event.origin!==location.origin||event.data?.type!=='AICC_BRIDGE_WAKE')return;
    const type=event.data.kind==='human-chat'?'AICC_HUMAN_CHAT_POLL':'AICC_NEXT_STEP_POLL';
    try{chrome.runtime.sendMessage({type});}catch{}
  });
})();
