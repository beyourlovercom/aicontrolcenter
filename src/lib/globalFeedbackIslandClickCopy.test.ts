import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonicalFeedbackCopyText,copyFailureFeedback,copySuccessFeedback,isCopyableFeedback} from './globalFeedbackInteraction.ts';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const island=readFileSync(new URL('../components/GlobalFeedbackIsland.svelte',import.meta.url),'utf8');

const running={state:'RUNNING' as const,title:'正在执行',message:'run-1787056459562-k2eyf6',code:'CODEX_RUNNING'};
const submitting={state:'SUBMITTING' as const,title:'正在提交',message:'run-1787056459562-k2eyf6'};
const longError='ROADMAP_EQUAL_REVISION_HASH_CONFLICT: '+ 'full-canonical-content-'.repeat(20);

assert.equal(canonicalFeedbackCopyText({state:'INFO',title:'主要提醒',message:''}),'主要提醒','primary feedback copies from canonical state');
assert.equal(canonicalFeedbackCopyText({state:'INFO',title:'主要提醒',message:'次要提醒'}),'主要提醒\n次要提醒','primary and secondary copy with a newline');
assert.equal(canonicalFeedbackCopyText({state:'ERROR',title:'Roadmap 同步未完成',message:longError}),`Roadmap 同步未完成\n${longError}`,'long errors retain their complete canonical content');
assert.equal(canonicalFeedbackCopyText(running),'正在执行\nrun-1787056459562-k2eyf6','exact running content remains copyable without internal status noise');
assert.equal(isCopyableFeedback(running),true);
assert.equal(isCopyableFeedback(submitting),true);
assert.equal(isCopyableFeedback(copySuccessFeedback()),false,'copy success cannot recursively copy itself');
assert.deepEqual(copySuccessFeedback(),{state:'SUCCESS',title:'复制成功',message:'完整提醒内容已复制到剪贴板',copyable:false});
assert.deepEqual(copyFailureFeedback(new Error('clipboard denied')),{state:'ERROR',title:'复制失败',message:'clipboard denied',copyable:true});
assert.match(app,/await navigator\.clipboard\.writeText\(canonicalFeedbackCopyText\(original\)\)/,'copy uses the canonical feedback state, never rendered DOM text');
assert.match(app,/const current=runtimeLifecycleFeedback\?\?fallback[\s\S]*if\(current\)setFeedback\(current/,'success overlay restores the current exact-run lifecycle when one is active');
assert.match(app,/if\(feedback!==original\)return;[\s\S]*const overlay=copySuccessFeedback/,'unrelated later feedback cannot be replaced by a stale copy completion');
assert.match(app,/setFeedback\(copyFailureFeedback\(error\)\)/,'clipboard failures surface as global ERROR feedback');
assert.equal((app.match(/<GlobalFeedbackIsland/g)??[]).length,1,'one global renderer');
assert.equal((app.match(/function setFeedback\(/g)??[]).length,1,'one global feedback authority');
assert.doesNotMatch(app,/feedbackCopyStore|copyToast|copyIsland|clipboardNotice|toast|snackbar/i,'no local copy feedback surface or store exists');
assert.match(island,/<button type="button"[\s\S]*disabled=\{!copyable\}[\s\S]*onclick=\{handleClick\}/,'native button guards non-copyable feedback while preserving keyboard activation');
assert.match(island,/class:copyable/,'only copyable items receive the pointer affordance');
assert.match(island,/\.global-feedback-island-shell button\.copyable\{cursor:pointer\}/,'copyable feedback has a restrained pointer cue');
assert.match(island,/else if\(copyable\)onCopy\(\)/,'copy success cannot call the copy callback again');
assert.doesNotMatch(island,/innerText|textContent|navigator\.clipboard/,'the renderer does not reconstruct copy text from its DOM');
assert.doesNotMatch(island,/feedback\.code/,'internal feedback/debug codes are not rendered');
assert.match(island,/\.global-feedback-island-shell\{position:fixed;top:8px;left:50%;z-index:60;[\s\S]*transform:translateX\(-50%\)/,'positioning and layout baseline remain untouched');
console.log('global feedback island click-copy regression matrix passed');
