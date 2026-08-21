<script lang="ts">
  import {onMount, tick} from 'svelte';

  export let payload='';
  export let instructionState:'TEXT_READY'|'IMPORTED_PENDING'|'RUN_STARTED'|'RESULT_RECEIVED'='TEXT_READY';
  export let contextLabel='当前上下文';
  export let onPayloadChange:(value:string)=>void=()=>{};
  export let onPaste:()=>Promise<unknown>|unknown=()=>{};
  export let onImport:(profile?:{model?:string;reasoning?:string})=>Promise<unknown>|unknown=()=>{};
  export let onProfileChange:(profile:{model:string;reasoning:string})=>Promise<unknown>|unknown=()=>{};
  export let onSubmitStart:()=>void=()=>{};
  export let copyResultAvailable=false;
  export let onCopyResult:()=>Promise<unknown>|unknown=()=>{};
  export let onHeightChange:(height:number)=>void=()=>{};

  type ModelOption={value:string;label:string;model:string;reasoning:string};
  const IDLE_INPUT_HEIGHT=32,MAX_INPUT_HEIGHT=208;
  let modelOptions:ModelOption[]=[],selectedModel='',selectedReasoning='',submitting=false,imeComposing=false,inputHeight=IDLE_INPUT_HEIGHT,input:HTMLTextAreaElement,shell:HTMLElement;
  $: canSubmit=Boolean(payload.trim())&&!submitting;
  $: expanded=inputHeight>IDLE_INPUT_HEIGHT;
  $: if(input){payload;void tick().then(()=>resizeInput());}

  async function loadModelOptions(){
    try{
      const response=await fetch('/api/providers/codex');
      const catalog=await response.json();
      modelOptions=(catalog.models??[]).flatMap((item:any)=>(item.reasoningLevels??[]).map((reasoning:string)=>({value:`${item.model}:${reasoning}`,label:`${item.displayName} · ${reasoning}`,model:item.model,reasoning})));
      const savedModel=localStorage.getItem('aicc-selected-model')??catalog.defaultModel;
      const savedReasoning=localStorage.getItem('aicc-selected-reasoning')??catalog.defaultReasoning;
      const saved=modelOptions.find(option=>option.model===savedModel&&option.reasoning===savedReasoning)??modelOptions[0];
      if(saved){selectedModel=saved.model;selectedReasoning=saved.reasoning;void onProfileChange({model:selectedModel,reasoning:selectedReasoning});}
    }catch{modelOptions=[];}
  }

  onMount(()=>{
    const observer=new ResizeObserver(()=>onHeightChange(Math.ceil(shell.getBoundingClientRect().height)));
    observer.observe(shell);
    void loadModelOptions().then(async()=>{await tick();resizeInput();});
    return ()=>{observer.disconnect();onHeightChange(0);};
  });

  function resizeInput(target=input){
    if(!target)return;
    target.style.height='auto';
    inputHeight=Math.min(Math.max(target.scrollHeight,IDLE_INPUT_HEIGHT),MAX_INPUT_HEIGHT);
    target.style.height=`${inputHeight}px`;
  }

  function updatePayload(target:HTMLTextAreaElement){onPayloadChange(target.value);resizeInput(target);}
  function persistModel(value:string){const selected=modelOptions.find(option=>option.value===value);if(!selected)return;selectedModel=selected.model;selectedReasoning=selected.reasoning;localStorage.setItem('aicc-selected-model',selected.model);localStorage.setItem('aicc-selected-reasoning',selected.reasoning);void onProfileChange({model:selectedModel,reasoning:selectedReasoning});}
  async function submit(){if(!canSubmit)return;submitting=true;onSubmitStart();try{await Promise.resolve(onImport({model:selectedModel||undefined,reasoning:selectedReasoning||undefined}));/* canonical onImport() callback preserves Composer execution ownership */}finally{submitting=false;}}
  function onKeydown(event:KeyboardEvent){if(event.key!=='Enter'||event.shiftKey||event.isComposing||imeComposing)return;event.preventDefault();void submit();}
</script>

<section bind:this={shell} class="global-composer-shell" data-testid="global-execution-composer-dock" aria-label="AICC 全局执行指令">
  <div class="global-composer-width-container">
    <form class:expanded class="global-execution-composer" onsubmit={(event)=>{event.preventDefault();void submit();}}>
      <div class="global-composer-leading" aria-label="指令操作">
        <button type="button" data-tooltip="更多操作" aria-label="更多操作" class="global-composer-icon">+</button>
        <button type="button" data-tooltip="粘贴指令" aria-label="粘贴指令" class="global-composer-icon" onclick={()=>void onPaste()}>▣</button>
        <button type="button" data-tooltip="导入指令" aria-label="导入指令" class="global-composer-icon" disabled={!payload.trim()} onclick={()=>void submit()}>⇧</button>
        <button type="button" data-tooltip="复制运行结果" aria-label="复制运行结果" class="global-composer-icon" disabled={!copyResultAvailable} onclick={()=>void onCopyResult()}>✅</button>
      </div>
      <textarea bind:this={input} value={payload} oninput={(event)=>updatePayload(event.currentTarget as HTMLTextAreaElement)} onkeydown={onKeydown} oncompositionstart={()=>imeComposing=true} oncompositionend={()=>imeComposing=false} placeholder="输入 AICC 指令…" aria-label="AICC 执行指令" rows="1"></textarea>
      <div class="global-composer-footer"><span class="global-composer-context" data-tooltip="当前上下文" aria-label={`当前上下文：${contextLabel}`} role="img">◇</span></div>
      <div class="global-composer-trailing">
        <select data-tooltip="选择执行模型和推理强度" title="选择执行模型和推理强度" aria-label="选择执行模型和推理强度" value={`${selectedModel}:${selectedReasoning}`} onchange={(event)=>persistModel((event.currentTarget as HTMLSelectElement).value)} disabled={!modelOptions.length}>{#each modelOptions as option}<option value={option.value}>{option.label}</option>{/each}</select>
        <button type="submit" class="global-composer-send" data-tooltip="发送到 AICC 执行" aria-label="发送到 AICC 执行" disabled={!canSubmit}>{submitting?'…':'↑'}</button>
      </div>
    </form>
  </div>
</section>

<style>
  .global-composer-shell{display:flex;width:100%;min-width:0;max-width:none;align-items:flex-end;justify-content:center;padding:10px 16px calc(10px + env(safe-area-inset-bottom));box-sizing:border-box;background:transparent;pointer-events:none}
  .global-composer-width-container{width:100%;min-width:0;max-width:48rem;margin-inline:auto;box-sizing:border-box;pointer-events:auto}
  .global-execution-composer{display:grid;width:100%;min-width:0;max-width:none;box-sizing:border-box;grid-template-columns:auto minmax(0,1fr) auto;grid-template-areas:"leading primary trailing";align-items:end;gap:6px;min-height:52px;padding:7px 8px;border:1px solid var(--border);border-radius:28px;background:var(--surface);box-shadow:0 10px 28px rgba(24,34,45,.12);pointer-events:auto}
  .global-execution-composer.expanded{grid-template-areas:"primary primary primary" "leading footer trailing";grid-template-rows:minmax(0,auto) 34px;align-items:end}.global-composer-leading{grid-area:leading}.global-composer-footer{grid-area:footer;display:none;min-width:0}.global-composer-trailing{grid-area:trailing}.global-composer-leading,.global-composer-trailing{display:flex;align-items:center;gap:3px;min-height:34px;flex-shrink:0}.global-composer-icon,.global-composer-send{position:relative;display:grid;width:32px;height:32px;place-items:center;padding:0;border:0;border-radius:50%;background:transparent;color:var(--text-2);font:600 16px/1 var(--font-ui);cursor:pointer}.global-composer-icon:hover{background:var(--surface-soft);color:var(--text-1)}.global-composer-icon:disabled{opacity:.42;cursor:not-allowed}.global-composer-icon[data-tooltip]:after,.global-composer-send[data-tooltip]:after,.global-composer-context[data-tooltip]:after{position:absolute;bottom:calc(100% + 7px);left:50%;z-index:4;display:none;width:max-content;max-width:180px;padding:6px 8px;transform:translateX(-50%);border:1px solid var(--border);border-radius:7px;background:rgba(248,250,252,.96);box-shadow:0 6px 18px rgba(23,32,45,.14);color:var(--text-1);content:attr(data-tooltip);font:500 11px/1.3 var(--font-ui);white-space:nowrap;pointer-events:none}.global-composer-icon[data-tooltip]:hover:after,.global-composer-icon[data-tooltip]:focus-visible:after,.global-composer-send[data-tooltip]:hover:after,.global-composer-send[data-tooltip]:focus-visible:after,.global-composer-context[data-tooltip]:hover:after{display:block}.global-execution-composer textarea{grid-area:primary;display:block;width:100%;min-width:0;max-height:208px;margin:0;padding:6px 2px;border:0;outline:0;background:transparent;color:var(--text-1);font:400 13px/1.45 var(--font-ui);resize:none;overflow-y:auto}.global-execution-composer textarea::placeholder{color:var(--text-3)}.global-composer-trailing{gap:5px;justify-self:end}.global-composer-context{position:relative;display:grid;width:24px;height:24px;place-items:center;color:var(--text-3);font-size:13px}.global-composer-trailing select{max-width:176px;border:0;background:transparent;color:var(--text-2);font:500 11px var(--font-ui);outline:0}.global-composer-send{background:var(--accent);color:#fff}.global-composer-send:disabled{background:#cbd5e1;color:#64748b;cursor:not-allowed}.global-execution-composer.expanded .global-composer-footer{display:flex;align-items:center;justify-content:center}.global-execution-composer.expanded textarea{align-self:start}@media(max-width:640px){.global-composer-shell{padding-inline:8px}.global-composer-width-container{width:100%}.global-composer-trailing select{max-width:118px}.global-composer-leading{gap:0}}
</style>
