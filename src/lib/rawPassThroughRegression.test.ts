import assert from 'node:assert/strict';
import {submitExecution} from './bridgeCore.ts';

const cases=[
  ['中文自然语言','检查当前 AICC 仓库状态','RAW'],
  ['英文自然语言','Inspect the current repository status','RAW'],
  ['协议前置文本','先说明背景\nAICC_EXECUTION_V1\nENTITY_ID: AICC-V2-TERMINAL-HANDOFF-001','PARTIAL'],
  ['部分协议缺 EXPECTED_HEAD','AICC_EXECUTION_V1\nENTITY_ID: AICC-V2-TERMINAL-HANDOFF-001\nINSTRUCTION_BEGIN\n继续执行\nINSTRUCTION_END','PARTIAL'],
  ['未知版本','AICC_EXECUTION_V9\n请继续执行当前任务','RAW'],
  ['完整协议',`AICC_EXECUTION_V1\nENTITY_TYPE: WORK_PACKAGE\nENTITY_ID: AICC-V2-TERMINAL-HANDOFF-001\nEXECUTION_TYPE: IMPLEMENTATION\nREPOSITORY: /repo\nBRANCH: rebuild/aicc-v2\nEXPECTED_HEAD: abc1234\nSANDBOX: workspace-write\n\nINSTRUCTION_BEGIN\n继续执行\nINSTRUCTION_END`,'PARSED'],
] as const;
for(const [name,text,status] of cases){const item=submitExecution(text,'WEB_BRIDGE');assert.equal(item.state,'READY',`${name} remains launchable`);assert.equal(item.parserStatus,status,`${name} metadata status`);assert.equal(item.rawInstruction,text,`${name} preserves raw text`);assert.ok(item.instruction,'all raw inputs produce an internal transport instruction')}
console.log('web bridge raw pass-through matrix passed');
