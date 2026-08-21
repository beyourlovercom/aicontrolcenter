export type EntityClass='FORMAL_WP'|'PHASE'|'TASK';

export type FormalWorkPackageRegistration={
  formalWpId:string;
  title:string;
  milestoneId:string;
  milestoneTitle:string;
};

export type BridgeTaskCatalogEntry={
  phaseId:'M8.2';
  phaseTitle:'M8.2 — GPT ↔ Codex Bridge';
  taskCode:string;
  taskTitle:string;
  instructionIds:string[];
  legacyEntityReferences:string[];
};

export type TaskEntityBinding={
  entityClass:'TASK';
  formalWpId:string|null;
  formalWpTitle:string|null;
  phaseId:string|null;
  phaseTitle:string|null;
  milestoneId:string|null;
  milestoneTitle:string|null;
  taskCode:string|null;
  taskTitle:string|null;
  legacyEntityReference:string|null;
  bindingState:'BOUND'|'UNMAPPED';
};

export const FORMAL_BRIDGE_WP_ID='AICC-V2-GPT-CODEX-BRIDGE-001';
export const FORMAL_BRIDGE_WP_TITLE='GPT ↔ Codex Execution Bridge';
export const BRIDGE_MILESTONE_ID='M8';
export const BRIDGE_MILESTONE_TITLE='M8 — AICC Lifecycle Intelligence';
export const BRIDGE_PHASE_ID='M8.2';
export const BRIDGE_PHASE_TITLE='M8.2 — GPT ↔ Codex Bridge';

export const BRIDGE_TASK_CATALOG:BridgeTaskCatalogEntry[]=[
  {phaseId:'M8.2',phaseTitle:BRIDGE_PHASE_TITLE,taskCode:'M8.2.1',taskTitle:'M8.2.1 — Bridge Action Extension',instructionIds:['m8.2.1-aicc-bridge-action-extension-001'],legacyEntityReferences:['AICC-M8.2.1-BRIDGE-ACTION-EXTENSION-001']},
  {phaseId:'M8.2',phaseTitle:BRIDGE_PHASE_TITLE,taskCode:'M8.2.1.1',taskTitle:'M8.2.1.1 — Bridge Action Extension Remediation',instructionIds:['m8.2.1.1-bridge-action-extension-remediation-001'],legacyEntityReferences:['AICC-M8.2.1.1-BRIDGE-ACTION-EXTENSION-REMEDIATION-001']},
  {phaseId:'M8.2',phaseTitle:BRIDGE_PHASE_TITLE,taskCode:'M8.2.1.3',taskTitle:'M8.2.1.3 — Clipboard Codex Execution',instructionIds:['m8.2.1.3-bridge-clipboard-codex-execution-001'],legacyEntityReferences:['AICC-M8.2.1.3-BRIDGE-CLIPBOARD-CODEX-EXECUTION-001','AICC-M8.2.1.3']},
  {phaseId:'M8.2',phaseTitle:BRIDGE_PHASE_TITLE,taskCode:'M8.2.1.4',taskTitle:'M8.2.1.4 — Codex Result Insert Reliability',instructionIds:['m8.2.1.4-codex-result-insert-reliability-001'],legacyEntityReferences:['AICC-M8.2.1.4-CODEX-RESULT-INSERT-RELIABILITY-001']},
  {phaseId:'M8.2',phaseTitle:BRIDGE_PHASE_TITLE,taskCode:'M8.2.1.5',taskTitle:'M8.2.1.5 — Bridge Runtime Result Panel',instructionIds:['m8.2.1.5-bridge-runtime-result-panel-001'],legacyEntityReferences:['AICC-M8.2.1.5-BRIDGE-RUNTIME-RESULT-PANEL-001']},
  {phaseId:'M8.2',phaseTitle:BRIDGE_PHASE_TITLE,taskCode:'M8.2.1.6',taskTitle:'M8.2.1.6 — Bridge Codex Model Selector',instructionIds:['m8.2.1.6-bridge-codex-model-selector-001'],legacyEntityReferences:['AICC-M8.2.1.6-BRIDGE-CODEX-MODEL-SELECTOR-001']},
  {phaseId:'M8.2',phaseTitle:BRIDGE_PHASE_TITLE,taskCode:'M8.2.1.6.1',taskTitle:'M8.2.1.6.1 — Codex Model Selector Test Sandbox Isolation',instructionIds:['m8.2.1.6.1-codex-model-selector-test-sandbox-isolation-001'],legacyEntityReferences:[]},
  {phaseId:'M8.2',phaseTitle:BRIDGE_PHASE_TITLE,taskCode:'M8.2.1.7',taskTitle:'M8.2.1.7 — Task / WP / Roadmap Binding Normalization',instructionIds:['m8.2.1.7-task-wp-roadmap-binding-normalization-001'],legacyEntityReferences:[]}
];

const normalized=(value:unknown)=>typeof value==='string'?value.trim().toLowerCase():'';
const roadmapNonIds=new Set(['ACTIVE','BLOCKED','CLOSED','COMPLETE','COMPLETED','CURRENT','PASS','PLANNED','READY','PENDING','WAITING_OWNER','WAITING_UAT']);
const escapeRegExp=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

export function extractRoadmapWorkPackageIds(declaration:string):string[]{
  return [...String(declaration??'').matchAll(/`([^`\s]+)`/g)]
    .map(match=>match[1].trim())
    .filter(id=>/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)&&!roadmapNonIds.has(id.toUpperCase()))
    .filter((id,index,all)=>all.indexOf(id)===index);
}

function extractRoadmapListItemWorkPackageIds(item:string):string[]{
  const declared=extractRoadmapWorkPackageIds(item);
  if(declared.length)return declared;
  const bareId=String(item??'').trim().match(/^([A-Za-z0-9][A-Za-z0-9._-]*)\.?$/)?.[1];
  return bareId&&/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(bareId)&&!roadmapNonIds.has(bareId.toUpperCase())?[bareId]:[];
}

function extractRoadmapWorkPackageListIds(block:string):string[]{
  const lines=String(block??'').replace(/\r\n?/g,'\n').split('\n');
  const ids:string[]=[];
  for(let index=0;index<lines.length;index+=1){
    const declaration=lines[index]?.match(/^\s*Work Packages?(?:\s*,[^\n:]*)?\s*:\s*(.*)$/i);
    if(!declaration)continue;
    ids.push(...extractRoadmapWorkPackageIds(declaration[1]));
    let sawListItem=false;
    for(index+=1;index<lines.length;index+=1){
      const line=lines[index]??'';
      if(!line.trim())continue;
      const item=line.match(/^\s*(?:[-+*]|\d+[.)])\s+(.+?)\s*$/);
      if(!item){
        if(sawListItem)break;
        break;
      }
      sawListItem=true;
      ids.push(...extractRoadmapListItemWorkPackageIds(item[1]));
    }
    index-=1;
  }
  return ids;
}

export function extractRoadmapMilestoneWorkPackageIds(block:string):string[]{
  const declarations=[...String(block??'').matchAll(/^Work Packages?:\s*(.+)$/gmi)].flatMap(match=>extractRoadmapWorkPackageIds(match[1]));
  const records=[...String(block??'').matchAll(/^`([^`\s]+)`\s+—\s+`?[A-Za-z][A-Za-z0-9_ /-]*`?[;:,]/gmi)].flatMap(match=>extractRoadmapWorkPackageIds(`\`${match[1]}\``));
  const lists=extractRoadmapWorkPackageListIds(block);
  return [...new Set([...declarations,...records,...lists])];
}

export function extractRoadmapWorkPackageTitle(block:string,formalWpId:string):string|null{
  const record=String(block??'').match(new RegExp('^`'+escapeRegExp(formalWpId)+'`\\s+—\\s+`?[A-Za-z][A-Za-z0-9_ /-]*`?[;:,]\\s*([^\\n.]+)', 'mi'));
  return record?.[1]?.trim()||null;
}

export function parseFormalWorkPackageRegistry(roadmap:string):Map<string,FormalWorkPackageRegistration>{
  const source=String(roadmap??''),active=source.includes('## Active V2 Milestones')?source.split('## Active V2 Milestones')[1]?.split('## Legacy Historical Milestones')[0]??'':source;
  const headers=[...active.matchAll(/^###\s+(M\d+)\s+—\s+(.+)$/gm)];
  const registry=new Map<string,FormalWorkPackageRegistration>();
  for(const [index,match] of headers.entries()){
    const milestoneId=match[1],milestoneTitle=`${milestoneId} — ${match[2].trim()}`;
    const body=active.slice((match.index??0)+match[0].length,headers[index+1]?.index??active.length);
    const declarations=[...body.matchAll(/^Work Packages?:\s*(.+)$/gmi)];
    for(const declaration of declarations){
      const ids=extractRoadmapWorkPackageIds(declaration[1]);
      for(const formalWpId of ids){
        const suffix=declaration[1].slice(declaration[1].indexOf(formalWpId)+formalWpId.length).replace(/^[`\s—:]+/,'').trim();
        const title=suffix.split(/\s*[;,]\s*|\s+`[A-Za-z0-9][A-Za-z0-9._-]*`/)[0]?.replace(/`+$/,'').trim()||formalWpId;
        if(!registry.has(formalWpId))registry.set(formalWpId,{formalWpId,title,milestoneId,milestoneTitle});
      }
    }
    for(const formalWpId of extractRoadmapMilestoneWorkPackageIds(body))if(!registry.has(formalWpId)){
      registry.set(formalWpId,{formalWpId,title:extractRoadmapWorkPackageTitle(body,formalWpId)??formalWpId,milestoneId,milestoneTitle});
    }
  }
  return registry;
}

export function bridgeTaskCatalogEntry(input:{instructionId?:unknown;taskId?:unknown;declaredTaskId?:unknown;entityId?:unknown;legacyEntityReference?:unknown}):BridgeTaskCatalogEntry|null{
  const candidates=[input.instructionId,input.taskId,input.declaredTaskId,input.entityId,input.legacyEntityReference].map(normalized).filter(Boolean);
  return BRIDGE_TASK_CATALOG.find(entry=>entry.instructionIds.some(value=>candidates.includes(normalized(value)))||entry.legacyEntityReferences.some(value=>candidates.includes(normalized(value))))??null;
}

export function readProtocolField(text:unknown,key:string):string|null{
  if(typeof text!=='string'||!text.trim())return null;
  const match=text.replace(/\r\n?/g,'\n').match(new RegExp(`(?:^|\\n)[ \\t]*${key}[ \\t]*(?:=|:)[ \\t]*(?:\\n[ \\t]*)?([^\\n]+)`,'i'));
  return match?.[1]?.trim()||null;
}

export function resolveTaskEntityBinding(input:{instructionId?:unknown;taskId?:unknown;declaredTaskId?:unknown;entityType?:unknown;entityId?:unknown;formalWpId?:unknown;workPackageId?:unknown;phaseId?:unknown;legacyEntityReference?:unknown},registry:Map<string,FormalWorkPackageRegistration>):TaskEntityBinding{
  const catalog=bridgeTaskCatalogEntry(input);
  const declaredEntityId=typeof input.entityId==='string'&&input.entityId.trim()?input.entityId.trim():null;
  const requestedFormalWpId=catalog?FORMAL_BRIDGE_WP_ID:[input.formalWpId,input.workPackageId,declaredEntityId].find(value=>typeof value==='string'&&registry.has(value)) as string|undefined;
  const registration=requestedFormalWpId?registry.get(requestedFormalWpId)??null:null;
  const legacyEntityReference=typeof input.legacyEntityReference==='string'&&input.legacyEntityReference.trim()?input.legacyEntityReference.trim():declaredEntityId&&declaredEntityId!==registration?.formalWpId?declaredEntityId:null;
  if(!registration)return {entityClass:'TASK',formalWpId:null,formalWpTitle:null,phaseId:null,phaseTitle:null,milestoneId:null,milestoneTitle:null,taskCode:catalog?.taskCode??null,taskTitle:catalog?.taskTitle??null,legacyEntityReference,bindingState:'UNMAPPED'};
  const declaredPhaseId=typeof input.phaseId==='string'&&input.phaseId.trim()?input.phaseId.trim():null;
  const bridgePhase=registration.formalWpId===FORMAL_BRIDGE_WP_ID&&(catalog||declaredPhaseId===BRIDGE_PHASE_ID);
  return {entityClass:'TASK',formalWpId:registration.formalWpId,formalWpTitle:registration.formalWpId===FORMAL_BRIDGE_WP_ID?FORMAL_BRIDGE_WP_TITLE:registration.title,phaseId:catalog?.phaseId??(bridgePhase?BRIDGE_PHASE_ID:null),phaseTitle:catalog?.phaseTitle??(bridgePhase?BRIDGE_PHASE_TITLE:null),milestoneId:registration.milestoneId,milestoneTitle:registration.milestoneTitle,taskCode:catalog?.taskCode??null,taskTitle:catalog?.taskTitle??null,legacyEntityReference,bindingState:'BOUND'};
}

export function isFormalWorkPackageEntity(id:string,registry:Map<string,FormalWorkPackageRegistration>):boolean{return registry.has(id)}

export function classifyEntityIdentity(id:string,registry:Map<string,FormalWorkPackageRegistration>):EntityClass|null{
  if(registry.has(id))return 'FORMAL_WP';
  if(id===BRIDGE_PHASE_ID)return 'PHASE';
  if(bridgeTaskCatalogEntry({instructionId:id,entityId:id}))return 'TASK';
  return null;
}

export function normalizedTaskBindingFields(binding:TaskEntityBinding,input:{taskId?:unknown;instructionId?:unknown;declaredTaskId?:unknown;origin?:unknown;executionId?:unknown;runId?:unknown}){
  return {
    entityClass:binding.entityClass,formalWpId:binding.formalWpId,phaseId:binding.phaseId,milestoneId:binding.milestoneId,legacyEntityReference:binding.legacyEntityReference,taskCode:binding.taskCode,taskTitle:binding.taskTitle,formalWpTitle:binding.formalWpTitle,phaseTitle:binding.phaseTitle,milestoneTitle:binding.milestoneTitle,bindingState:binding.bindingState,
    task_id:typeof input.taskId==='string'?input.taskId:null,instruction_id:typeof input.declaredTaskId==='string'&&input.declaredTaskId?input.declaredTaskId:typeof input.instructionId==='string'?input.instructionId:null,entity_class:binding.entityClass,formal_wp_id:binding.formalWpId,phase_id:binding.phaseId,milestone_id:binding.milestoneId,origin_source:typeof input.origin==='string'?input.origin:null,execution_id:typeof input.executionId==='string'?input.executionId:null,run_id:typeof input.runId==='string'?input.runId:null,legacy_entity_reference:binding.legacyEntityReference
  };
}
