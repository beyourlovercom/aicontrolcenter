import type {AiccProjectSnapshot} from './model/entityTypes.ts';
import {createEmptyGlobalStateReadModel} from './globalStateReadModel.ts';
import {projectWpLayer2,type WpLayer2Projection} from './wpCanonicalProjection.ts';
import type {RoadmapProjection} from './roadmapProjection.ts';

export type GlobalWorkPackageProjection={
  wp_id:string; custom_title:string; milestone_id:string; milestone_title:string;
  wp_lifecycle:string; wp_progress:WpLayer2Projection['records'][number]['progress'];
  current_phase:string; phase_plan_availability:'AVAILABLE'|'NOT_AVAILABLE';
  roadmap_group_number:string|null; roadmap_group_title:string|null;
  status:string; owner_state:string; related_pr_count:number;
  related_task_count:number; evidence_state:string; workPackageId:string; title:string;
  milestoneId:string; phase:string; layer2?:WpLayer2Projection['records'][number];
  globalStateProjectionRevision?:number; entityProjectionRevision?:number;
};
export type GlobalFocus={milestone:string;workPackage:string;phase:string};

export function projectGlobalWorkPackages(snapshot:AiccProjectSnapshot,tasks:any[]=[],projection?:WpLayer2Projection):GlobalWorkPackageProjection[]{
  if(!projection)throw new Error('WP_PROJECT_SCOPE_REQUIRED');
  return projection.records.map(record=>({wp_id:record.id,custom_title:record.title,milestone_id:record.milestoneId,milestone_title:record.milestoneTitle,wp_lifecycle:record.lifecycleStatus,wp_progress:record.progress,current_phase:record.phase??'—',phase_plan_availability:record.phasePlanAvailability,roadmap_group_number:record.roadmapGroupNumber,roadmap_group_title:record.roadmapGroupTitle,status:record.lifecycleStatus,owner_state:record.progress.state==='KNOWN'?'CANONICAL_ROADMAP_PROGRESS':'UNKNOWN',related_pr_count:record.prIds.length,related_task_count:record.taskIds.length,evidence_state:record.progress.state==='KNOWN'?'BOUND':'NOT_BOUND',workPackageId:record.id,title:record.title,milestoneId:record.milestoneId,phase:record.phase??'—',layer2:record,globalStateProjectionRevision:projection.model.globalProjectionRevision,entityProjectionRevision:record.entityProjectionRevision}));
}

export function projectGlobalFocus(snapshot:AiccProjectSnapshot,projection?:WpLayer2Projection,roadmapProjection?:RoadmapProjection|null):GlobalFocus{
  if(!projection)throw new Error('WP_PROJECT_SCOPE_REQUIRED');
  const canonicalMilestone=roadmapProjection?.currentMilestone?.trim(),canonicalWorkPackage=roadmapProjection?.currentWorkPackage?.trim(),canonicalPhase=roadmapProjection?.currentPhase?.trim();
  if(canonicalMilestone&&canonicalWorkPackage&&canonicalPhase&&![canonicalMilestone,canonicalWorkPackage,canonicalPhase].includes('NOT_AVAILABLE'))return {milestone:canonicalMilestone,workPackage:canonicalWorkPackage,phase:canonicalPhase};
  for(const record of projection.records){
    if(record.phase)return {milestone:record.milestoneTitle,workPackage:record.id,phase:record.phase};
  }
  return {milestone:'—',workPackage:'—',phase:'—'};
}

export function projectGlobalMilestones(snapshot:AiccProjectSnapshot){return [...(snapshot.roadmap.value??[])]}

export function projectGlobalCounts(snapshot:AiccProjectSnapshot,tasks:any[]=[],projection?:WpLayer2Projection){
  const workPackages=projectGlobalWorkPackages(snapshot,tasks,projection);
  const prs=snapshot.pullRequests.value??[];
  return {workPackages:workPackages.length,pullRequests:prs.length,tasks:tasks.length};
}
