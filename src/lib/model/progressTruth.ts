import type {CanonicalExecutionResult,HumanUatRecord,LifecycleEvidenceRecord,RuntimeRecord,RoadmapEvidence,RoadmapSyncState,WorkPackagePhaseProgress,WorkPackagePhaseStatus} from './entityTypes.ts';

export type ProgressEvidenceType='ROADMAP'|'EXECUTION'|'CODEX_RESULT'|'UAT'|'CODEX_AUDIT';
export type ProgressTruthSource='Execution Evidence'|'Codex Result'|'Owner UAT'|'Local Roadmap'|'GitHub Roadmap'|'Local + GitHub Roadmap'|'Mixed Evidence';
export type ProgressEvidence={id:string;type:ProgressEvidenceType;workPackageId:string;phaseNumber:number;phaseTitle?:string;status?:WorkPackagePhaseStatus;at:string;source:ProgressTruthSource;explicit:true};
export type ProgressTruthState={entityId:string;milestoneId:string;workPackageId:string;currentPhaseNumber:number|null;currentPhaseTitle:string|null;phaseStatuses:WorkPackagePhaseProgress['phases'];progressEvidenceSource:ProgressTruthSource;progressEvidenceId:string|null;progressEvidenceType:ProgressEvidenceType|null;progressEvidenceAt:string|null;roadmapMetadataPhase:number|null;roadmapMetadataStale:boolean;syncStatus:RoadmapSyncState['syncStatus'];roadmapProgressSource:RoadmapSyncState['currentProgressSource'];};

const date=(value?:string)=>value?Date.parse(value)||0:0;
const explicit=(text:string,workPackageId:string,type:ProgressEvidenceType,source:ProgressTruthSource,at:string):ProgressEvidence[]=>{
  const out:ProgressEvidence[]=[];
  const patterns=[/PHASE[_ ](\d+)[ _]STATUS\s*[:=]\s*(COMPLETE|ACTIVE|PENDING)/gi,/CURRENT[_ ]PHASE\s*[:=]\s*(\d+)/gi,/NEXT[_ ]PHASE\s*[:=]\s*PHASE[_ ](\d+)/gi];
  for(const match of text.matchAll(patterns[0]))out.push({id:`${type}:${workPackageId}:${match.index}`,type,workPackageId,phaseNumber:Number(match[1]),status:match[2].toUpperCase() as WorkPackagePhaseStatus,at,source,explicit:true});
  for(const pattern of patterns.slice(1))for(const match of text.matchAll(pattern))out.push({id:`${type}:${workPackageId}:${match.index}`,type,workPackageId,phaseNumber:Number(match[1]),at,source,explicit:true});
  return out;
};

export function resolveProgressTruthState(args:{entityId:string;milestoneId?:string;workPackageId:string;roadmap:WorkPackagePhaseProgress|null;runtime?:RuntimeRecord|null;codexResult?:CanonicalExecutionResult|null;codexResults?:CanonicalExecutionResult[];uat?:HumanUatRecord|null;lifecycleEvidence?:LifecycleEvidenceRecord|null;roadmapSync:RoadmapSyncState}):ProgressTruthState{
  const plan=args.roadmap?.phases??[];
  const metadata=args.roadmap?.currentPhaseNumber??null;
  const candidates:ProgressEvidence[]=[];
  for(const [source,evidence] of [['Local Roadmap',args.roadmapSync.localEvidence] as const,['GitHub Roadmap',args.roadmapSync.githubEvidence] as const]){
    const declared=evidence?.phaseEvidence?.[args.workPackageId];
    const phase=declared?.match(/(?:PHASE[_ ]|CURRENT[_ ]PHASE\s*[:=]\s*)(\d+)/i)?.[1]??declared?.match(/^(\d+)$/)?.[1];
    if(phase)candidates.push({id:`ROADMAP:${source}:${args.workPackageId}`,type:'ROADMAP',workPackageId:args.workPackageId,phaseNumber:Number(phase),at:args.roadmapSync.updatedAt,source:source as ProgressTruthSource,explicit:true});
  }
  if(args.runtime){const text=[args.runtime.implementationResult].filter(Boolean).join('\n');if(text)candidates.push(...explicit(text,args.workPackageId,'EXECUTION','Execution Evidence',args.runtime.completedAt??args.runtime.lastActivityAt));}
  const codexResults=[...(args.codexResults??[]),...(args.codexResult?[args.codexResult]:[])].filter((result,index,array)=>array.findIndex(item=>item.resultId===result.resultId)===index);
  for(const result of codexResults)candidates.push(...explicit(result.rawResult,args.workPackageId,'CODEX_RESULT','Codex Result',result.receivedAt));
  if(args.uat)candidates.push(...explicit([args.uat.overallNote,...args.uat.items.flatMap(item=>item.evidence??[])].filter(Boolean).join('\n'),args.workPackageId,'UAT','Owner UAT',args.uat.updatedAt));
  for(const item of args.lifecycleEvidence?.phaseEvidence??[])candidates.push({id:`CODEX_AUDIT:${args.workPackageId}:phase-${item.phaseNumber}`,type:'CODEX_AUDIT',workPackageId:args.workPackageId,phaseNumber:item.phaseNumber,phaseTitle:item.phaseTitle,status:item.status,at:item.recordedAt,source:'Codex Result',explicit:true});
  const relevant=candidates.filter(item=>item.workPackageId===args.workPackageId).sort((a,b)=>date(b.at)-date(a.at)||(b.source===('GitHub Roadmap' as ProgressTruthSource)?1:0)-(a.source===('GitHub Roadmap' as ProgressTruthSource)?1:0));
  const selected=relevant[0];
  const phases=plan.map(phase=>({...phase}));
  if(selected){const target=phases.find(phase=>phase.number===selected.phaseNumber);if(target){target.status=selected.status??'ACTIVE';}else phases.push({number:selected.phaseNumber,title:selected.phaseTitle??`Phase ${selected.phaseNumber}`,status:selected.status??'ACTIVE'});}
  const current=selected?phases.find(phase=>phase.number===selected.phaseNumber):phases.find(phase=>phase.status==='ACTIVE');
  const source=selected?.type==='ROADMAP'&&args.roadmapSync.syncStatus==='SYNCED'?'Local + GitHub Roadmap':selected?.source??(args.roadmapSync.githubEvidence&&!args.roadmapSync.localEvidence?'GitHub Roadmap':args.roadmapSync.currentProgressSource);
  return {entityId:args.entityId,milestoneId:args.milestoneId??'',workPackageId:args.workPackageId,currentPhaseNumber:current?.number??null,currentPhaseTitle:current?.title??null,phaseStatuses:phases,progressEvidenceSource:source,progressEvidenceId:selected?.id??null,progressEvidenceType:selected?.type??'ROADMAP',progressEvidenceAt:selected?.at??null,roadmapMetadataPhase:metadata,roadmapMetadataStale:selected?selected.phaseNumber!==metadata:false,syncStatus:args.roadmapSync.syncStatus,roadmapProgressSource:args.roadmapSync.currentProgressSource};
}
