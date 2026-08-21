<script lang="ts">
  import {onDestroy} from 'svelte';
  import {isCopyableFeedback,type GlobalFeedbackState} from '../lib/globalFeedbackInteraction.ts';

  export let feedback:GlobalFeedbackState;
  export let onCopy:()=>void=()=>{};

  type IslandState='IDLE'|'COMPACT'|'EXPANDED';
  let presentation:IslandState='IDLE';
  let retractTimer:number|undefined;
  let lastFeedbackKey='';

  $: copyable=isCopyableFeedback(feedback);
  $: feedbackKey=[feedback.state,feedback.title,feedback.message,feedback.next??''].join('\u0000');
  $: if(feedbackKey!==lastFeedbackKey){
    lastFeedbackKey=feedbackKey;
    if(retractTimer)clearTimeout(retractTimer);
    if(feedback.state==='IDLE')presentation='IDLE';
    else {
      presentation='EXPANDED';
      retractTimer=window.setTimeout(()=>{presentation='COMPACT';retractTimer=undefined},3000);
    }
  }

  function expand(){
    if(retractTimer)clearTimeout(retractTimer);
    retractTimer=undefined;
    presentation='EXPANDED';
  }

  function handleClick(){
    if(presentation!=='EXPANDED')expand();
    else if(copyable)onCopy();
  }

  onDestroy(()=>{if(retractTimer)clearTimeout(retractTimer)});
</script>

<div class="global-feedback-island-shell state-{presentation.toLowerCase()}" data-testid="global-feedback-island" data-island-state={presentation.toLowerCase()} data-feedback-state={feedback.state.toLowerCase()} role="status">
  {#if presentation==='EXPANDED'}
    <button type="button" class:running={feedback.state==='RUNNING'||feedback.state==='SUBMITTING'} class:success={feedback.state==='SUCCESS'} class:error={feedback.state==='ERROR'} class:warning={feedback.state==='BLOCKED'} class:copyable aria-live={feedback.state==='ERROR'||feedback.state==='BLOCKED'?'assertive':'polite'} aria-label={copyable?'复制完整提醒内容':undefined} disabled={!copyable} onclick={handleClick}>
      <span class="feedback-icon" aria-hidden="true">{feedback.state==='ERROR'?'!':feedback.state==='SUCCESS'?'✓':feedback.state==='BLOCKED'?'⚠':'•'}</span>
      <span class="feedback-copy"><strong>{feedback.title}</strong><span>{feedback.message}</span></span>
    </button>
  {:else}
    <button type="button" class="feedback-compact" aria-label="展开全局提醒" onclick={expand}>
      <span class="feedback-icon" aria-hidden="true">{feedback.state==='IDLE'?'•':feedback.state==='ERROR'?'!':feedback.state==='SUCCESS'?'✓':'•'}</span>
      <span>{feedback.state==='IDLE'?'全局提醒':feedback.title||'全局提醒'}</span>
    </button>
  {/if}
</div>

<style>
  .global-feedback-island-shell{position:fixed;top:8px;left:50%;z-index:60;transform:translateX(-50%);pointer-events:none;font-family:var(--font-ui);background:rgba(248, 249, 251, 0.30);backdrop-filter:blur(5px) saturate(115%);-webkit-backdrop-filter:blur(5px) saturate(115%);border:1px solid rgba(255, 255, 255, 0.45);box-shadow:0 4px 18px rgba(15, 23, 42, 0.07),inset 0 1px 0 rgba(255, 255, 255, 0.28);opacity:1}
  .global-feedback-island-shell button{pointer-events:auto;font:inherit;color:inherit;background:transparent;border:0;box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none}
  .global-feedback-island-shell button.copyable{cursor:pointer}
  .global-feedback-island-shell button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .feedback-compact{display:flex;align-items:center;gap:6px;min-width:92px;max-width:min(300px,calc(100vw - 24px));height:24px;padding:0 10px;border-radius:999px;cursor:pointer;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .state-idle .feedback-compact{color:var(--ink-muted)}
  .state-expanded{border-radius:var(--radius-md)}
  .state-idle,.state-compact{border-radius:999px}
  .state-expanded button{display:flex;align-items:flex-start;gap:10px;width:min(440px,calc(100vw - 24px));padding:11px 14px;border-radius:var(--radius-md);text-align:left}
  .feedback-icon{display:grid;flex:0 0 auto;place-items:center;width:18px;height:18px;border-radius:50%;background:#73808b;color:#fff;font-size:11px;font-weight:800}
  .feedback-copy{min-width:0;background:transparent}.feedback-copy strong,.feedback-copy span{display:block}.feedback-copy strong{font-size:13px}.feedback-copy span{margin-top:3px;color:var(--ink-muted);font-size:11px;line-height:1.45}
  .feedback-compact .feedback-icon{width:10px;height:10px;font-size:8px}.running .feedback-icon{background:#3976b9}.success .feedback-icon{background:#3e9b6b}.error .feedback-icon{background:#c45d42}.warning .feedback-icon{background:#b78a31}
</style>
