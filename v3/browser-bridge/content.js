(()=>{
  'use strict';
  const CONTENT_VERSION='3.8.13';
  if(globalThis.__AICC_V3_BRIDGE_CONTENT_VERSION__===CONTENT_VERSION)return;
  try{globalThis.__AICC_V3_BRIDGE_CLEANUP__?.();}catch{}
  globalThis.__AICC_V3_BRIDGE_CONTENT_VERSION__=CONTENT_VERSION;
  const BUTTON_ATTR='data-aicc-v3-bridge';
  for(const stale of document.querySelectorAll(`button[${BUTTON_ATTR}]`))stale.remove();
  document.getElementById('aicc-v3-bridge-modal-host')?.remove();

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
  function snapshotMessageId(node,index,role){
    const turn=node.closest('[data-testid^="conversation-turn-"],[data-message-id],article');
    return turn?.getAttribute('data-message-id')||turn?.getAttribute('data-testid')||`${role}-${index}`;
  }
  function conversationSnapshot(){
    const id=conversationId();if(!id)return null;
    const nodes=[...document.querySelectorAll('[data-message-author-role="user"],[data-message-author-role="assistant"]')];
    const messages=nodes.slice(-120).map((node,index)=>({
      messageId:snapshotMessageId(node,index,node.getAttribute('data-message-author-role')||'unknown'),
      role:node.getAttribute('data-message-author-role'),
      text:(node.innerText||node.textContent||'').trim().slice(0,6000)
    })).filter(item=>(item.role==='user'||item.role==='assistant')&&item.text);
    return {conversationId:id,conversationUrl:`https://chatgpt.com/c/${encodeURIComponent(id)}`,title:(document.title||'ChatGPT Conversation').replace(/\s*[-–—]\s*ChatGPT\s*$/i,'').trim()||'ChatGPT Conversation',capturedAt:new Date().toISOString(),messages};
  }
  function message(type,payload={},timeout=5000){
    return new Promise((resolve,reject)=>{
      let settled=false;
      const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);fn(value);};
      const timer=setTimeout(()=>finish(reject,Object.assign(new Error('BRIDGE_BACKGROUND_TIMEOUT'),{code:'BRIDGE_BACKGROUND_TIMEOUT'})),timeout);
      try{
        chrome.runtime.sendMessage({type,...payload},response=>{
          const lastError=chrome.runtime.lastError;
          if(lastError)return finish(reject,Object.assign(new Error(lastError.message||'BRIDGE_CLIENT_ERROR'),{code:'BRIDGE_CLIENT_ERROR'}));
          finish(resolve,response);
        });
      }catch(error){finish(reject,error);}
    });
  }

  let snapshotTimer=null;let lastSnapshotSignature='';
  async function publishSnapshot(){
    const snapshot=conversationSnapshot();if(!snapshot)return;
    const last=snapshot.messages.at(-1);const signature=`${snapshot.conversationId}:${snapshot.messages.length}:${last?.role||''}:${(last?.text||'').slice(-240)}`;
    if(signature===lastSnapshotSignature)return;lastSnapshotSignature=signature;
    try{await message('AICC_PUBLISH_SNAPSHOT',{snapshot},8000);}catch{}
  }
  function scheduleSnapshot(){clearTimeout(snapshotTimer);snapshotTimer=setTimeout(()=>void publishSnapshot(),900);}

  let modal=null;
  function ensureModal(){
    if(modal)return modal;
    const host=document.createElement('div');host.id='aicc-v3-bridge-modal-host';document.documentElement.appendChild(host);
    const shadow=host.attachShadow({mode:'closed'});
    shadow.innerHTML=`<style>
      .backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:2147483646;display:flex;align-items:center;justify-content:center}
      .card{width:min(680px,92vw);max-height:84vh;overflow:auto;background:#fff;color:#111;border-radius:14px;padding:18px;font:14px system-ui;box-shadow:0 20px 60px #0006}
      h3{margin:0 0 12px} label{display:block;margin:10px 0 5px;font-weight:600} select,textarea{width:100%;box-sizing:border-box;font:13px ui-monospace,monospace}
      textarea{min-height:220px;padding:10px;background:#fafafa}select{padding:8px}.binding{padding:9px 10px;border:1px solid #ddd;border-radius:8px;background:#f7f7f7;font:12px ui-monospace,monospace;white-space:pre-wrap}.required{color:#b42318;font-weight:700}.row{display:flex;gap:8px;justify-content:flex-end;margin-top:12px} button{padding:8px 12px;border-radius:8px;border:1px solid #ccc;background:#fff;cursor:pointer}.go{background:#111;color:#fff}.status{font-size:12px;margin-top:8px;white-space:pre-wrap}
    </style><div class="backdrop"><div class="card"><h3>✦ AICC · Explicit Run</h3><label>Task binding</label><select class="task"></select><div class="binding"></div><label>Task Name <span class="required">(required)</span></label><div class="task-name binding"></div><label>Exact Assistant instruction</label><textarea class="instruction" readonly></textarea><div class="status"></div><div class="row"><button class="cancel">Cancel</button><button class="go">Send to AICC</button></div></div></div>`;
    modal={host,shadow,task:shadow.querySelector('.task'),binding:shadow.querySelector('.binding'),taskName:shadow.querySelector('.task-name'),instruction:shadow.querySelector('.instruction'),status:shadow.querySelector('.status'),go:shadow.querySelector('.go')};
    shadow.querySelector('.cancel').onclick=()=>{host.remove();modal=null;};
    return modal;
  }
  function marker(text,name){
    const match=text.match(new RegExp(`^${name}\s*:\s*(.+)$`,'mi'));return match?.[1]?.trim()||null;
  }
  function automaticBinding(sourceText){
    const id=conversationId();
    const lines=sourceText.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
    const first=lines.find(line=>!/^AICC_(WORK_PACKAGE|TASK|PR)\s*:/i.test(line))||'Assistant execution';
    const workPackageTitle=(marker(sourceText,'AICC_WORK_PACKAGE')||`ChatGPT conversation ${id||'unknown'}`).slice(0,200);
    const taskTitle=(marker(sourceText,'AICC_TASK')||first).slice(0,200);
    return {workPackageTitle,taskTitle};
  }
  function selectedTaskName(ui,binding){
    if(!ui.task.value)return binding.taskTitle.trim();
    return (ui.task.selectedOptions[0]?.dataset?.taskTitle||'').trim();
  }
  function taskNameGate(ui,binding){
    const name=selectedTaskName(ui,binding);ui.taskName.textContent=name||'MISSING';
    if(!name){ui.go.disabled=true;ui.status.textContent='Task Name is required. Submission blocked.';return false;}
    return true;
  }
  function showBinding(ui,binding){
    const selected=ui.task.value;
    ui.binding.textContent=selected?`Mode: Existing exact Task\nTask ID: ${selected}`:`Mode: Auto create/bind\nWP: ${binding.workPackageTitle}`;
    return taskNameGate(ui,binding);
  }
  async function openExplicitRun(sourceText){
    const ui=ensureModal();const binding=automaticBinding(sourceText);
    ui.instruction.value=sourceText;ui.task.textContent='';
    const auto=document.createElement('option');auto.value='';auto.dataset.taskTitle=binding.taskTitle;auto.textContent=`Auto · ${binding.taskTitle}`;ui.task.appendChild(auto);
    ui.status.textContent='Loading existing Tasks…';ui.go.disabled=true;showBinding(ui,binding);
    let response;try{response=await message('AICC_LIST_TASKS');}catch(error){response={ok:false,errorCode:error?.code||'BRIDGE_CLIENT_ERROR'};}
    if(response?.ok){
      for(const task of response.tasks||[]){
        if(typeof task?.id!=='string'||!task.id.trim()||typeof task?.title!=='string'||!task.title.trim())continue;
        const option=document.createElement('option');option.value=task.id;option.dataset.taskTitle=task.title.trim();option.textContent=`${task.title} · ${task.status} · ${task.id}`;ui.task.appendChild(option);
      }
      ui.status.textContent=`Ready · Task Name required · ${Math.max(0,ui.task.options.length-1)} existing Task(s) available.`;
    }else ui.status.textContent=`Existing Task list unavailable: ${response?.errorCode||'BRIDGE_CLIENT_ERROR'} · Auto Task Name must remain valid.`;
    ui.go.disabled=false;showBinding(ui,binding);
    ui.task.onchange=()=>{if(showBinding(ui,binding))ui.status.textContent='Ready · Task Name validated.';};
    ui.go.onclick=async()=>{
      if(!taskNameGate(ui,binding))return;
      const taskTitle=selectedTaskName(ui,binding);
      ui.go.disabled=true;ui.status.textContent='Submitting exact Assistant execution to AICC…';
      const payload={url:location.href,instruction:sourceText,taskTitle};
      if(ui.task.value)payload.taskId=ui.task.value;else payload.workPackageTitle=binding.workPackageTitle;
      let result;try{result=await message('AICC_SUBMIT_EXPLICIT',payload);}catch(error){result={ok:false,errorCode:error?.code||'BRIDGE_CLIENT_ERROR'};}
      if(!result?.ok){ui.status.textContent=result?.errorCode||'Bridge request failed';ui.go.disabled=false;return;}
      ui.task.disabled=true;
      ui.go.disabled=true;ui.go.textContent='Submitted';
      ui.status.textContent=`Queued request ${result.requestId}\nRun pending in AICC background\n${ui.task.value?'Existing Task bound exactly.':'WP/Task auto-bound.'} Auto-return is bound to this conversation only.\nExact instruction frozen for this request.`;
    };
  }

  function isCopyButton(button){
    const id=button.getAttribute('data-testid')||'';
    const label=button.getAttribute('aria-label')||button.getAttribute('title')||'';
    return id==='copy-turn-action-button'||/^(copy|复制)$/i.test(label.trim());
  }
  function isAssistantActionRow(row){
    const buttons=[...row.querySelectorAll('button')];
    if(buttons.length<3)return false;
    return buttons.some(button=>{
      const id=button.getAttribute('data-testid')||'';
      const label=button.getAttribute('aria-label')||button.getAttribute('title')||'';
      return /regenerate|retry|重新生成|重试/i.test(`${id} ${label}`);
    })||buttons.length>=4;
  }
  function actionRowFromCopy(copy){
    let row=copy.parentElement;
    for(let depth=0;row&&depth<6;depth++,row=row.parentElement){
      if(isAssistantActionRow(row))return row;
    }
    return null;
  }
  function turnContainerFromRow(row){
    const direct=row.closest('[data-testid^="conversation-turn-"],article,[data-message-id]');
    if(direct)return direct;
    let current=row.parentElement;
    for(let depth=0;current&&depth<12;depth++,current=current.parentElement){
      const copies=[...current.querySelectorAll('button')].filter(isCopyButton);
      if(copies.length===1&&(current.innerText||'').trim())return current;
    }
    return null;
  }
  function sourceTextForRow(row){
    const container=turnContainerFromRow(row);if(!container)return '';
    const assistant=container.querySelector('[data-message-author-role="assistant"]');
    if(assistant)return assistantText(assistant);
    const clone=container.cloneNode(true);
    for(const button of clone.querySelectorAll('button'))button.remove();
    for(const host of clone.querySelectorAll('#aicc-v3-bridge-modal-host'))host.remove();
    return (clone.innerText||clone.textContent||'').trim();
  }
  function injectButtons(){
    const copies=[...document.querySelectorAll('button')].filter(isCopyButton);
    for(const copy of copies){
      const row=actionRowFromCopy(copy);if(!row||row.querySelector(`button[${BUTTON_ATTR}]`))continue;
      const text=sourceTextForRow(row);if(!text.trim())continue;
      const button=document.createElement('button');button.type='button';button.textContent='✦ AICC';button.setAttribute(BUTTON_ATTR,'1');button.setAttribute('aria-label','Send this Assistant turn to AICC');
      Object.assign(button.style,{marginLeft:'6px',padding:'3px 8px',minHeight:'28px',border:'1px solid rgba(0,0,0,.18)',borderRadius:'999px',background:'transparent',font:'12px system-ui',lineHeight:'1',cursor:'pointer',whiteSpace:'nowrap'});
      button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();void openExplicitRun(text);});
      row.appendChild(button);
    }
  }

  const observer=new MutationObserver(()=>{injectButtons();scheduleSnapshot();});observer.observe(document.documentElement,{childList:true,subtree:true});injectButtons();scheduleSnapshot();
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
  function userTurnCount(){return document.querySelectorAll('[data-message-author-role="user"]').length;}
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
    const before=userTurnCount();
    try{button.click();}catch{return {outcome:'UNCERTAIN',reason:'BRIDGE_SEND_CLICK_UNCERTAIN'};}
    const proved=await waitFor(()=>conversationId()===message.conversationId&&userTurnCount()>before&&composerValue(box)!==message.content,12000,150);
    return proved?{outcome:'DELIVERED'}:{outcome:'UNCERTAIN',reason:'BRIDGE_SEND_PROOF_UNAVAILABLE'};
  }

  function bridgeListener(message,_sender,sendResponse){
    if(message?.type==='AICC_READ_SNAPSHOT'){sendResponse({ok:true,snapshot:conversationSnapshot()});return false;}
    if(message?.type!=='AICC_DELIVER_EXACT')return false;
    void deliverExact(message).then(sendResponse).catch(()=>sendResponse({outcome:'UNCERTAIN',reason:'BRIDGE_CONTENT_ADAPTER_ERROR'}));
    return true;
  }
  chrome.runtime.onMessage.addListener(bridgeListener);
  globalThis.__AICC_V3_BRIDGE_CLEANUP__=()=>{
    try{observer.disconnect();}catch{}
    try{chrome.runtime.onMessage.removeListener(bridgeListener);}catch{}
    clearTimeout(snapshotTimer);
    for(const stale of document.querySelectorAll(`button[${BUTTON_ATTR}]`))stale.remove();
    document.getElementById('aicc-v3-bridge-modal-host')?.remove();
  };
})();
