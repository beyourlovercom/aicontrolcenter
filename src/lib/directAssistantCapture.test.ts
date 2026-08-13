import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';

const script=readFileSync(join(process.cwd(),'web-adapter/chatgpt-dom.js'),'utf8');
const context={};vm.runInNewContext(script,context);
const dom=(context as {AICCChatGPTDom:{resolveInstructionSource:(document:unknown,selection:string)=>{source:string;block:string|null;error:string|null}}}).AICCChatGPTDom;
const fixture=`AICC_EXECUTION_V1\nINSTRUCTION_ID: owner-uat-round2-d5dca141\nENTITY_TYPE: WORK_PACKAGE\nENTITY_ID: AICC-V2-GPT-BRIDGE-001\nEXECUTION_TYPE: READ_ONLY_AUDIT\nREPOSITORY: /Users/a/AI/007/AIcontrolcenter\nBRANCH: rebuild/aicc-v2\nEXPECTED_HEAD: d5dca141ec52db79cfbedc48558549a4d180424a\nSANDBOX: read-only\nREQUIRES_AUTHORIZATION: false\n\nINSTRUCTION_BEGIN\nInspect the GPT Bridge formal Work Package and report exactly:\nOWNER_UAT_ROUND2_FINAL_OK\n\nDo not modify files.\nINSTRUCTION_END`;
const documentFor=(assistant:string[],composer='')=>({querySelectorAll:(_selector:string)=>assistant.map(text=>({innerText:text})),querySelector:(_selector:string)=>composer?{value:composer}:null});
const selected=dom.resolveInstructionSource(documentFor(['Assistant prose '+fixture+' trailing prose'],'COMPOSER'),fixture);assert.equal(selected.source,'Selected Text');assert.equal(selected.block,fixture);assert.equal(selected.block?.includes('Assistant prose'),false);assert.equal(selected.block?.includes('trailing prose'),false);
const assistant=dom.resolveInstructionSource(documentFor(['older',`Assistant says: ${fixture}\nNo action needed.`],'COMPOSER'),'');assert.equal(assistant.source,'Assistant');assert.equal(assistant.block,fixture);
const fallback=dom.resolveInstructionSource(documentFor(['no protocol'],fixture),'');assert.equal(fallback.source,'Composer');assert.equal(fallback.block,fixture);
const ambiguous=dom.resolveInstructionSource(documentFor([`${fixture}\n${fixture.replace('owner-uat-round2-d5dca141','second')}`]),'');assert.equal(ambiguous.error,'AMBIGUOUS_INSTRUCTION');assert.equal(ambiguous.block,null);
const partial=dom.resolveInstructionSource(documentFor(['AICC_EXECUTION_V1\nINSTRUCTION_BEGIN\npartial']), '');assert.equal(partial.error,'NO_COMPLETE_INSTRUCTION');assert.equal(partial.block,null);
console.log('direct Assistant capture matrix passed');
