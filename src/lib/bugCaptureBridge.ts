import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {resolveAiccStateDir} from './stateDirectory.ts';

export const AICC_BUG_CAPTURE_V1='AICC_BUG_CAPTURE_V1' as const;
export const AICC_BUG_CAPTURE_RESULT_V1='AICC_BUG_CAPTURE_RESULT_V1' as const;
export const CANONICAL_BUG_REGISTRY='docs/80_Bug_Record/01_bug_record.md' as const;
const severities=new Set(['P0','P1','P2','P3','UNTRIAGED']);
const blocksCurrentScopeValues=new Set(['YES','NO','UNKNOWN']);

export type BugCaptureOrigin={conversationId?:string;messageId?:string};
export type BugCapturePayload={captureId:string;title:string;severity:'P0'|'P1'|'P2'|'P3'|'UNTRIAGED';status:'Reported';affectedModule:string;blocksCurrentScope:'YES'|'NO'|'UNKNOWN';expected:string;actual:string;reproduction:string;evidence:string;environment:string;discoveredBy:'OWNER'|'GPT'|'CODEX';sourceConversation:string;sourceMessage:string;recommendedRouting:'INTERRUPT'|'DEFER'|'OWNER_REVIEW';existingBugId?:string};
export type BugCaptureResult={captureId:string;result:'CREATED'|'UPDATED'|'NEEDS_TRIAGE'|'FAILED';bugId:string|'NOT_ASSIGNED';registry:typeof CANONICAL_BUG_REGISTRY;mainlineInterrupted:'YES'|'NO';fixStarted:'NO';reason?:string};
type CaptureState={identity:string;captureId:string;origin:BugCaptureOrigin;payloadHash:string;state:'RECEIVED'|'PERSISTED'|'REGISTRY_RECONCILED'|'CAPTURED';result?:BugCaptureResult;receivedAt:string;updatedAt:string;payload:BugCapturePayload};
export type BugCaptureOptions={registryPath?:string;statePath?:string;now?:()=>string};

function atomicWrite(path:string,value:string){mkdirSync(dirname(path),{recursive:true});const temporary=`${path}.${process.pid}.${Date.now()}.tmp`;writeFileSync(temporary,value,{encoding:'utf8',mode:0o600});renameSync(temporary,path)}
function statePath(options:BugCaptureOptions){return options.statePath??join(resolveAiccStateDir(),'bug-captures.json')}
function registryPath(options:BugCaptureOptions){return options.registryPath??join(process.cwd(),CANONICAL_BUG_REGISTRY)}
function readStates(path:string):CaptureState[]{try{const value=JSON.parse(readFileSync(path,'utf8'));return Array.isArray(value)?value as CaptureState[]:[]}catch{return []}}
function saveStates(path:string,states:CaptureState[]){atomicWrite(path,`${JSON.stringify(states,null,2)}\n`)}
function normal(value:string){return String(value??'').replace(/\r\n?/g,'\n').trim()}
function field(text:string,key:string){const match=text.match(new RegExp(`(?:^|\\n)${key}\\s*:\\s*([\\s\\S]*?)(?=\\n(?:CAPTURE_ID|TITLE|SEVERITY|STATUS|AFFECTED_MODULE|BLOCKS_CURRENT_SCOPE|EXPECTED|ACTUAL|REPRODUCTION|EVIDENCE|ENVIRONMENT|DISCOVERED_BY|SOURCE_CONVERSATION|SOURCE_MESSAGE|RECOMMENDED_ROUTING|EXISTING_BUG_ID)\\s*:|\\nEND_AICC_BUG_CAPTURE_V1(?:\\n|$))`,'i'));return match?.[1]?.trim()??''}
function required(value:string,key:string){if(!value)throw new Error(`${key}_REQUIRED`);return value}
function captureBlock(text:string){const blocks=[...normal(text).matchAll(/(?:^|\n)(AICC_BUG_CAPTURE_V1\n[\s\S]*?\nEND_AICC_BUG_CAPTURE_V1)(?=\n|$)/g)].map(match=>match[1]);if(blocks.length!==1)throw new Error(blocks.length?'BUG_CAPTURE_MULTIPLE_BLOCKS':'BUG_CAPTURE_PROTOCOL_REQUIRED');return blocks[0]}
export function parseBugCaptureV1(text:string):BugCapturePayload{
  const block=captureBlock(text),value=(key:string)=>field(block,key),captureId=required(value('CAPTURE_ID'),'CAPTURE_ID');
  if(!/^[A-Za-z0-9._-]{8,160}$/.test(captureId))throw new Error('CAPTURE_ID_INVALID');
  const severity=required(value('SEVERITY'),'SEVERITY').toUpperCase();if(!severities.has(severity))throw new Error('BUG_SEVERITY_INVALID');
  const status=required(value('STATUS'),'STATUS');if(status!=='Reported')throw new Error('BUG_STATUS_INVALID');
  const blocksCurrentScope=required(value('BLOCKS_CURRENT_SCOPE'),'BLOCKS_CURRENT_SCOPE').toUpperCase();if(!blocksCurrentScopeValues.has(blocksCurrentScope))throw new Error('BLOCKS_CURRENT_SCOPE_INVALID');
  const discoveredBy=required(value('DISCOVERED_BY'),'DISCOVERED_BY').toUpperCase();if(!['OWNER','GPT','CODEX'].includes(discoveredBy))throw new Error('DISCOVERED_BY_INVALID');
  const recommendedRouting=required(value('RECOMMENDED_ROUTING'),'RECOMMENDED_ROUTING').toUpperCase();if(!['INTERRUPT','DEFER','OWNER_REVIEW'].includes(recommendedRouting))throw new Error('RECOMMENDED_ROUTING_INVALID');
  const existingBugId=value('EXISTING_BUG_ID');if(existingBugId&&!/^AICC-BUG-\d{3,}$/.test(existingBugId))throw new Error('EXISTING_BUG_ID_INVALID');
  return {captureId,title:required(value('TITLE'),'TITLE'),severity:severity as BugCapturePayload['severity'],status:'Reported',affectedModule:value('AFFECTED_MODULE')||'UNKNOWN',blocksCurrentScope:blocksCurrentScope as BugCapturePayload['blocksCurrentScope'],expected:required(value('EXPECTED'),'EXPECTED'),actual:required(value('ACTUAL'),'ACTUAL'),reproduction:value('REPRODUCTION')||'NOT_AVAILABLE',evidence:required(value('EVIDENCE'),'EVIDENCE'),environment:value('ENVIRONMENT')||'UNKNOWN',discoveredBy:discoveredBy as BugCapturePayload['discoveredBy'],sourceConversation:value('SOURCE_CONVERSATION')||'UNKNOWN',sourceMessage:value('SOURCE_MESSAGE')||'UNKNOWN',recommendedRouting:recommendedRouting as BugCapturePayload['recommendedRouting'],existingBugId:existingBugId||undefined};
}
function captureIdentity(payload:BugCapturePayload,origin:BugCaptureOrigin){return `${payload.captureId}|${origin.conversationId??payload.sourceConversation??'UNKNOWN'}|${origin.messageId??payload.sourceMessage??'UNKNOWN'}`}
function payloadHash(payload:BugCapturePayload){return createHash('sha256').update(JSON.stringify(payload)).digest('hex')}
function mainlineInterrupted(payload:BugCapturePayload):'YES'|'NO'{return payload.severity==='P0'||payload.severity==='P1'&&payload.blocksCurrentScope==='YES'?'YES':'NO'}
function existingBugIds(registry:string){return [...registry.matchAll(/^## (AICC-BUG-\d+)$/gm)].map(match=>match[1])}
function nextBugId(registry:string){const max=Math.max(0,...existingBugIds(registry).map(id=>Number(id.slice('AICC-BUG-'.length))));return `AICC-BUG-${String(max+1).padStart(3,'0')}`}
function hasBug(registry:string,id:string){return new RegExp(`^## ${id}$`,'m').test(registry)}
function hasExactTitle(registry:string,title:string){const escaped=title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp(`^- Title: ${escaped}$`,'mi').test(registry)}
function summaryRow(id:string,payload:BugCapturePayload,discoveredAt:string){return `| ${id} | ${payload.severity} | ${payload.status} | ${payload.affectedModule.replace(/\|/g,'/') } | ${payload.title.replace(/\|/g,'/') } | ${payload.blocksCurrentScope} | ${discoveredAt.slice(0,10)} |`}
function detailRecord(id:string,payload:BugCapturePayload,discoveredAt:string){return `## ${id}\n\n- Title: ${payload.title}\n- Severity: ${payload.severity}\n- Status: ${payload.status}\n- Affected Module: ${payload.affectedModule}\n- Discovered At: ${discoveredAt}\n- Discovered By: ${payload.discoveredBy}\n- Environment: ${payload.environment}\n- Commit SHA: NOT_CAPTURED\n- Blocks Current Scope: ${payload.blocksCurrentScope}\n\n### Expected\n\n${payload.expected}\n\n### Actual\n\n${payload.actual}\n\n### Reproduction\n\n${payload.reproduction}\n\n### Evidence\n\n${payload.evidence}\n\n### Deferred Reason\n\nCaptured through the explicit GPT Bug Capture Bridge. This record does not authorize a fix.\n\n### Target Remediation Phase\n\n${payload.recommendedRouting==='INTERRUPT'?'Current governed interruption path':'Final Project Bug Sweep unless explicitly reprioritized.'}\n\n### Resolution\n\nNOT_YET\n\n### Additional Evidence\n\n- Capture ID: ${payload.captureId}\n- Source Conversation: ${payload.sourceConversation}\n- Source Message: ${payload.sourceMessage}\n`}
function appendEvidence(registry:string,id:string,payload:BugCapturePayload,at:string){const heading=`## ${id}`,start=registry.indexOf(heading);if(start<0)throw new Error('EXISTING_BUG_NOT_FOUND');const next=registry.indexOf('\n## ',start+heading.length);const end=next<0?registry.length:next;const record=registry.slice(start,end);const addition=`\n- Capture ID: ${payload.captureId} · ${at}\n- Source Conversation: ${payload.sourceConversation}\n- Source Message: ${payload.sourceMessage}\n- Evidence: ${payload.evidence}\n`;
  const marker='### Additional Evidence\n';const index=record.indexOf(marker);const updated=index>=0?`${record.slice(0,index+marker.length)}${addition}${record.slice(index+marker.length)}`:`${record.trimEnd()}\n\n${marker}${addition}`;return `${registry.slice(0,start)}${updated}${registry.slice(end)}`;
}
function addNewBug(registry:string,id:string,payload:BugCapturePayload,at:string){const tableEnd=registry.indexOf('\n\n## Bug Records');if(tableEnd<0)throw new Error('BUG_REGISTRY_STRUCTURE_INVALID');const withSummary=`${registry.slice(0,tableEnd)}\n${summaryRow(id,payload,at)}${registry.slice(tableEnd)}`;const recordsMarker='## Bug Records\n';const insertAt=withSummary.indexOf(recordsMarker);if(insertAt<0)throw new Error('BUG_REGISTRY_STRUCTURE_INVALID');const after=insertAt+recordsMarker.length;return `${withSummary.slice(0,after)}\n${detailRecord(id,payload,at)}\n${withSummary.slice(after)}`}
function writeRegistry(path:string,value:string){if(!existsSync(path))throw new Error('BUG_REGISTRY_NOT_FOUND');atomicWrite(path,value)}
export function formatBugCaptureResult(result:BugCaptureResult){return `${AICC_BUG_CAPTURE_RESULT_V1}\n\nCAPTURE_ID: ${result.captureId}\nRESULT: ${result.result}\nBUG_ID: ${result.bugId}\nREGISTRY:\n${result.registry}\nMAINLINE_INTERRUPTED: ${result.mainlineInterrupted}\nFIX_STARTED: ${result.fixStarted}`}
export function captureBug(text:string,origin:BugCaptureOrigin={},options:BugCaptureOptions={}):BugCaptureResult{
  const payload=parseBugCaptureV1(text),now=options.now?.()??new Date().toISOString(),identity=captureIdentity(payload,origin),states=readStates(statePath(options)),known=states.find(item=>item.identity===identity);
  if(known?.result)return known.result;
  const state:CaptureState=known??{identity,captureId:payload.captureId,origin,payloadHash:payloadHash(payload),state:'RECEIVED',receivedAt:now,updatedAt:now,payload};
  if(known&&known.payloadHash!==payloadHash(payload))throw new Error('CAPTURE_IDENTITY_CONFLICT');
  const persist=(next:CaptureState)=>{const index=states.findIndex(item=>item.identity===identity);if(index>=0)states[index]=next;else states.unshift(next);saveStates(statePath(options),states.slice(0,500));};
  state.state='PERSISTED';state.updatedAt=now;persist(state);
  try{
    const path=registryPath(options),registry=readFileSync(path,'utf8');let result:BugCaptureResult;
    if(payload.existingBugId){
      if(!hasBug(registry,payload.existingBugId))throw new Error('EXISTING_BUG_NOT_FOUND');
      writeRegistry(path,appendEvidence(registry,payload.existingBugId,payload,now));
      result={captureId:payload.captureId,result:'UPDATED',bugId:payload.existingBugId,registry:CANONICAL_BUG_REGISTRY,mainlineInterrupted:mainlineInterrupted(payload),fixStarted:'NO'};
    }else if(hasExactTitle(registry,payload.title)){
      result={captureId:payload.captureId,result:'NEEDS_TRIAGE',bugId:'NOT_ASSIGNED',registry:CANONICAL_BUG_REGISTRY,mainlineInterrupted:'NO',fixStarted:'NO',reason:'EXACT_TITLE_MATCH_REQUIRES_EXISTING_BUG_ID'};
    }else{
      const id=nextBugId(registry);writeRegistry(path,addNewBug(registry,id,payload,now));
      result={captureId:payload.captureId,result:'CREATED',bugId:id,registry:CANONICAL_BUG_REGISTRY,mainlineInterrupted:mainlineInterrupted(payload),fixStarted:'NO'};
    }
    state.state='REGISTRY_RECONCILED';state.result=result;state.updatedAt=now;persist(state);state.state='CAPTURED';state.updatedAt=now;persist(state);return result;
  }catch(error){const result:BugCaptureResult={captureId:payload.captureId,result:'FAILED',bugId:'NOT_ASSIGNED',registry:CANONICAL_BUG_REGISTRY,mainlineInterrupted:'NO',fixStarted:'NO',reason:error instanceof Error?error.message:'BUG_CAPTURE_FAILED'};state.result=result;state.updatedAt=now;persist(state);return result}
}
