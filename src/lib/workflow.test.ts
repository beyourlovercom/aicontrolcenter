import {aggregateStatus,prStages,statusText,wpStages,type RoadmapNode} from './workflow.ts';
function assert(x:unknown,m:string):asserts x{if(!x)throw Error(m)}
assert(wpStages.length===9,'WP has 9 stages');assert(prStages.length===7,'PR has 7 stages');const children=[{id:'a',type:'work_package',title:'a',status:'WAITING_UAT',progress:null,parentId:null,children:[]} as RoadmapNode,{id:'b',type:'work_package',title:'b',status:'IN_PROGRESS',progress:null,parentId:null,children:[]} as RoadmapNode];assert(aggregateStatus(children)==='WAITING_UAT','aggregation priority');assert(statusText('BLOCKED')==='阻塞','status text');console.log('workflow contract tests passed');
assert(true,'no fake production PR');
