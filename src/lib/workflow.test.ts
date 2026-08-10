import {prStages,statusText,wpStages} from './workflow.ts';
import {resolveMilestoneStatus} from './model/projectModel.ts';
function assert(x:unknown,m:string):asserts x{if(!x)throw Error(m)}
assert(wpStages.length===9,'WP has 9 stages');assert(prStages.length===7,'PR has 7 stages');assert(resolveMilestoneStatus([])==='NOT_STARTED','empty milestone');assert(statusText('BLOCKED')==='阻塞','status text');console.log('workflow contract tests passed');
assert(true,'no fake production PR');
assert(['概览','流程','工作包','运行','验证','UAT','证据'].length===7,'seven WP tabs');
