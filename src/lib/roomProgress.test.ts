import assert from 'node:assert/strict';
import {projectRoomProgress} from './roomProgress.ts';
const room:any={projectId:'family-plan',workstreamId:'family-sync',branch:'feature/old',baseSha:'a'.repeat(40)};
const facts:any={project:{available:true,value:{repository:{branch:'feature/new',head:'b'.repeat(40)}}},work:{available:true,value:{workPackages:[{id:'wp1',title:'G4',status:'ACTIVE'}],tasks:[{id:'t1',title:'Canary',status:'DONE'}]}},prDelivery:{available:true,value:{pullRequests:[{number:41,title:'Projection',state:'OPEN',isDraft:false,headRefOid:'c'.repeat(40)}],checks:[]}}};
const p=projectRoomProgress(room,facts,null,'MATCH');
assert.equal(p.blueprint[0].state,'done');assert.equal(p.workPackages[0].title,'G4');assert.equal(p.tasks[0].state,'done');assert.match(p.pullRequests[0].title,/PR #41/);
const blocked=projectRoomProgress(room,facts,{state:{state:'STOP_GATE'}} as any,'DRIFT');assert.equal(blocked.gates[0].state,'blocked');
console.log('roomProgress.test.ts PASS');
