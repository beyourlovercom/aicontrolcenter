(()=>{
  'use strict';
  const BUTTON_ATTR='data-aicc-v3-bridge';

  function conversationId(){
    try{
      const parts=location.pathname.split('/').filter(Boolean);const marker=parts.lastIndexOf('c');
      return marker>=0&&parts[marker+1]?decodeURIComponent(parts[marker+1]):null;
    }catch{return null;}
  }
  async function sha256(text){
    const bytes=new TextEncoder().encode(text);const hash=await crypto.subtle.digest('SHA-256',bytes);
    return [...new Uint8Array(hash)].map(value=>value.toString(16).padStart(2,'0')).join('');
  }
  function assistantText(node){return typeof node?.innerText==='string'?node.innerText:'';}
  function message(type,payload={}){return chrome.runtime.sendMessage({type,...payload});}

  let modal=null;
  function ensureModal(){
    if(modal)return modal;
    const host=document.createElement('div');host.id='aicc-v3-bridge-modal-host';document.documentElement.appendChild(host);
    const shadow=host.attachShadow({mode:'closed'});
    shadow.innerHTML=`<style>
      .backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:2147483646;display:flex;align-items:center;justify-content:center}
      .card{width:min(680px,92vw);max-height:84vh;overflow:auto;background:#fff;color:#111;border-radius:14px;padding:18px;font:14px system-ui;box-shadow:0 20px 60px #0006}
      h3{margin:0 0 12px} label{display:block;margin:10px 0 5px;font-weight:600} select,textarea{width:100%;box-sizing:border-box;font:13px ui-monospace,monospace}
      textarea{min-height:220px;padding:10px} select{padding:8px} .row{display:flex;gap:8px;justify-content:flex-end;margin-top:12px} button{padding:8px 12px;border-radius:8px;border:1px solid #ccc;background:#fff;cursor:pointer}.go{background:#111;color:#fff}.status{font-size:12px;margin-top:8px;white-space:pre-wrap}
    </style><div class="backdrop"><div class="card"><h3>✦ AICC · Explicit Run</h3><label>Task</label><select class="task"></select><label>Exact instruction</label><textarea class="instruction"></textarea><div class="status"></div><div class="row"><button class="cancel">Cancel</button><button class="go">Send to AICC</button></div></div></div>`;
    modal={host,shadow,task:shadow.querySelector('.task'),instruction:shadow.querySelector('.instruction'),status:shadow.querySelector('.status'),go:shadow.querySelector('.go')};
    shadow.querySelector('.cancel').onclick=()=>{host.remove();modal=null;};
    return modal;
  }
  async function openExplicitRun(sourceText){
    const ui=ensureModal();ui.instruction.value=sourceText;ui.status.textContent='Loading Tasks…';ui.go.disabled=true;
    let response;try{response=await message('AICC_LIST_TASKS');}catch{response={ok:false,errorCode:'BRIDGE_AICC_UNREACHABLE'};}
    if(!response?.ok){ui.status.textContent=response?.errorCode||'Unable to load Tasks';return;}
    ui.task.textContent='';
    for(const task of response.tasks||[]){const option=document.createElement('option');option.value=task.id;option.textContent=`${task.title} · ${task.status} · ${task.id}`;ui.task.appendChild(option);}
    if(!ui.task.options.length){ui.status.textContent='No AICC Task available.';return;}
    ui.status.textContent='Choose the exact Task and review the instruction before sending.';ui.go.disabled=false;
    ui.go.onclick=async()=>{
      ui.go.disabled=true;ui.status.textContent='Submitting explicit Bridge request…';
      let result;try{result=await message('AICC_SUBMIT_EXPLICIT',{url:location.href,taskId:ui.task.value,instruction:ui.instruction.value});}catch{result={ok:false,errorCode:'BRIDGE_CLIENT_ERROR'};}
      if(!result?.ok){ui.status.textContent=result?.errorCode||'Bridge request failed';ui.go.disabled=false;return;}
      ui.status.textContent=`Bound request ${result.requestId}\nRun ${result.runId||'pending'}\nAuto-return is bound to this conversation only.`;
    };
  }

  function injectButtons(){
    for(const node of document.querySelectorAll('[data-message-author-role="assistant"]')){
      const container=node.closest('article')||node.parentElement;if(!container||container.hasAttribute(BUTTON_ATTR))continue;
      const text=assistantText(node);if(!text.trim())continue;
      container.setAttribute(BUTTON_ATTR,'1');
      const button=document.createElement('button');button.type='button';button.textContent='✦ AICC';button.setAttribute('aria-label','Send this Assistant turn to AICC');
      Object.assign(button.style,{margin:'8px 0',padding:'4px 9px',border:'1px solid #aaa',borderRadius:'999px',background:'transparent',font:'12px system-ui',cursor:'pointer'});
      button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();void openExplicitRun(text);});
      container.appendChild(button);
    }
  }

  const observer=new MutationObserver(()=>injectButtons());observer.observe(document.documentElement,{childList:true,subtree:true});injectButtons();
  function composer(){return document.querySelector('#prompt-textarea');}
  function composerValue(node){
    if(!node)return null;
    if(node instanceof HTMLTextAreaElement||node instanceof HTMLInputElement)return node.value;
    return node.innerText??node.textContent??'';
  }
  function writeComposer(node,content){
    node.focus();
    if(node instanceof HTMLTextAreaElement||node instanceof HTMLInputElement){
      const proto=node instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
      const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;if(!setter)return false;
      setter.call(node,content);node.dispatchEvent(new Event('input',{bubbles:true}));return composerValue(node)===content;
    }
    try{document.execCommand('selectAll',false,null);document.execCommand('insertText',false,content);}catch{}
    if(composerValue(node)!==content){node.textContent=content;node.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:content}));}
    return composerValue(node)===content;
  }
  function exactUserCount(content){
    let count=0;for(const node of document.querySelectorAll('[data-message-author-role="user"]'))if((node.innerText??node.textContent??'')===content)count++;return count;
  }
  async function waitFor(check,timeout=5000,step=100){
    const end=Date.now()+timeout;while(Date.now()<end){const value=check();if(value)return value;await new Promise(resolve=>setTimeout(resolve,step));}return null;
  }
  async function sendButton(){
    return waitFor(()=>{const button=document.querySelector('button[data-testid="send-button"]');return button&&!button.disabled?button:null;},5000,100);
  }
  async function deliverExact(message){
    if(conversationId()!==message.conversationId)return {outcome:'ABORTED_BEFORE_SEND',reason:'BRIDGE_CONVERSATION_MISMATCH'};
    if(typeof message.content!=='string'||await sha256(message.content)!==message.contentSha256)return {outcome:'ABORTED_BEFORE_SEND',reason:'BRIDGE_CONTENT_HASH_MISMATCH'};
    const box=await waitFor(()=>composer(),5000,100);if(!box)return {outcome:'ABORTED_BEFORE_SEND',reason:'BRIDGE_COMPOSER_NOT_FOUND'};
    if(!writeComposer(box,message.content))return {outcome:'ABORTED_BEFORE_SEND',reason:'BRIDGE_COMPOSER_EXACT_CONTENT_UNAVAILABLE'};
    if(conversationId()!==message.conversationId)return {outcome:'ABORTED_BEFORE_SEND',reason:'BRIDGE_CONVERSATION_MISMATCH'};
    const button=await sendButton();if(!button)return {outcome:'ABORTED_BEFORE_SEND',reason:'BRIDGE_SEND_CONTROL_NOT_FOUND'};
    if(composerValue(box)!==message.content)return {outcome:'ABORTED_BEFORE_SEND',reason:'BRIDGE_COMPOSER_CONTENT_DRIFT'};
    const before=exactUserCount(message.content);
    try{button.click();}catch{return {outcome:'UNCERTAIN',reason:'BRIDGE_SEND_CLICK_UNCERTAIN'};}
    const proved=await waitFor(()=>conversationId()===message.conversationId&&exactUserCount(message.content)>before,12000,150);
    return proved?{outcome:'DELIVERED'}:{outcome:'UNCERTAIN',reason:'BRIDGE_SEND_PROOF_UNAVAILABLE'};
  }

  chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{
    if(message?.type!=='AICC_DELIVER_EXACT')return false;
    void deliverExact(message).then(sendResponse).catch(()=>sendResponse({outcome:'UNCERTAIN',reason:'BRIDGE_CONTENT_ADAPTER_ERROR'}));
    return true;
  });
})();
