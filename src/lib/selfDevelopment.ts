export type SelfDevelopmentContext={project_id:string;repository_id:string;roadmap:string;architecture_context:string;active_milestone:string;development_policy:string};
export const AICC_SELF_CONTEXT:SelfDevelopmentContext={project_id:'aicontrolcenter',repository_id:'AIcontrolcenter',roadmap:'M11+',architecture_context:'AICC V2',active_milestone:'M11.0',development_policy:'WP + Owner UAT required'};
export function registerAiccSelf(){return {name:'AI Control Center',...AICC_SELF_CONTEXT,status:'ACTIVE'}}
export function createImprovementSignal(kind:string,description:string){return {signal_id:`aicc-signal-${Date.now()}`,project_id:AICC_SELF_CONTEXT.project_id,kind,description,source:'AICC_SELF_ISSUE_INTELLIGENCE',requires_review:true}}
export function selfProposalLoop(signal:{signal_id:string;description:string}){return {proposal_id:`aicc-proposal-${signal.signal_id}`,source_signal:signal.signal_id,status:'REVIEW_REQUIRED',review_authority:'GPT_OR_OWNER',github_source_of_truth:false}}
export function selfExecutionBinding(wp_id:string){return {wp_id,project_id:AICC_SELF_CONTEXT.project_id,provider:'codex',requires_approved_wp:true,requires_owner_uat:true}}
export function selfEvidenceTracking(wp_id:string,evidence:string[]){return {wp_id,types:['REQUIREMENT','PLAN','COMMIT','PR','CI','UAT','RELEASE'],recorded:evidence}}
export function selfRoadmapProjection(){return {current:['M11.0'],completed:['M10.0','M10.1','M10.2','M10.3'],planned:['M11.1','M11.2'],source:'GITHUB',readOnly:true}}
export function selfGovernance(){return {canDetect:true,canAnalyze:true,canRecommend:true,canExecuteApprovedWork:true,canModifyWithoutWp:false,canCreateUncontrolledChanges:false,canBypassOwnerUat:false,canApproveOwnProposal:false}}
