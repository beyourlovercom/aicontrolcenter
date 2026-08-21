export type GlobalFeedbackState={state:'IDLE'|'INFO'|'RUNNING'|'SUBMITTING'|'SUCCESS'|'BLOCKED'|'ERROR';title:string;message:string;code?:string;next?:string;copyable?:boolean};

export function isCopyableFeedback(feedback:GlobalFeedbackState){return feedback.state!=='IDLE'&&feedback.copyable!==false}

export function canonicalFeedbackCopyText(feedback:GlobalFeedbackState){
  return [feedback.title,feedback.message,feedback.next?`下一步：${feedback.next}`:''].filter(Boolean).join('\n');
}

export function feedbackPresentationKey(feedback:GlobalFeedbackState){return [feedback.state,feedback.title,feedback.message].join('\u0000')}

export function copySuccessFeedback():GlobalFeedbackState{return {state:'SUCCESS',title:'复制成功',message:'完整提醒内容已复制到剪贴板',copyable:false}}

export function copyFailureFeedback(reason:unknown):GlobalFeedbackState{
  const raw=reason instanceof Error?reason.message:typeof reason==='string'?reason:'CLIPBOARD_WRITE_FAILED';
  const message=raw.replace(/[\r\n]+/g,' ').trim().slice(0,160)||'CLIPBOARD_WRITE_FAILED';
  return {state:'ERROR',title:'复制失败',message,copyable:true};
}
