import { nextStepEligibility, nextStepStatusLabel, submitNextStep } from './nextStep.ts';
import { createDefaultExecutionRoomStore, bindGptConversation, updateExecutionRoom } from './executionRoomState.ts';
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
let store=createDefaultExecutionRoomStore();
store=bindGptConversation(store,'traffic',{conversationId:'conv-1',conversationUrl:'https://chatgpt.com/c/conv-1',title:'Real'});
store=updateExecutionRoom(store,'traffic',room=>({...room,branch:'feat/v54',worktree:'/wt/v54'}));
const room=store.rooms.traffic;
const snapshot:any={conversationId:'conv-1',conversationUrl:'https://chatgpt.com/c/conv-1',title:'Real',capturedAt:new Date().toISOString(),messages:[]};
const facts:any={project:{available:true,value:{repository:{identity:'owner/repo',path:'/wt/v54',branch:'feat/v54',head:'abc',dirty:false}}},executor:{available:true,value:{readiness:{ready:true},activeLease:null,latestRun:null}},prDelivery:{available:true,value:null},work:{available:true,value:{workPackages:[],tasks:[]}}};
assert(nextStepEligibility(room,facts,snapshot).ready,'exact bound clean runtime is eligible');
assert(nextStepEligibility({...room,branch:'drift'},facts,snapshot).blockers.includes('RUNTIME_DRIFT'),'runtime drift blocks');
assert(nextStepEligibility(room,{...facts,project:{available:true,value:{repository:{...facts.project.value.repository,dirty:true}}}},snapshot).blockers.includes('WORKTREE_DIRTY'),'dirty worktree blocks');
assert(nextStepEligibility(room,facts,null).blockers.includes('GPT_SNAPSHOT_STALE'),'stale GPT snapshot blocks');
let body:any=null;
const fetcher:any=async(_url:string,init:any)=>{body=JSON.parse(init.body);return new Response(JSON.stringify({request:{requestId:'n1',roomId:'traffic',conversationId:'conv-1',promptSha256:'h',createdAt:'now'},state:{requestId:'n1',state:'PENDING',updatedAt:'now'}}),{status:201,headers:{'content-type':'application/json'}});};
const queued=await submitNextStep(room,'owner draft',fetcher);assert(body.branch==='feat/v54'&&body.conversationId==='conv-1','submission freezes exact room binding');assert(queued.state.state==='PENDING','submission returns server state');assert(nextStepStatusLabel(queued)==='等待 Profile 12 Bridge','status label reflects queue');
console.log('nextStep.test.ts PASS');
