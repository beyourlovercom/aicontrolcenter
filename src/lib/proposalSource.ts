export type WorkPackageProposalSource='GPT_ASSISTED'|'GITHUB'|'OWNER_CREATED'|'AICC_SUGGESTION';
export type AutonomousProposalState='SUGGESTED'|'OWNER_REVIEW'|'APPROVED_FOR_EXPORT'|'EXPORTED'|'SYNCED_TO_WP'|'REJECTED';
export type ProposalExportBoundary={ownerConfirmed:boolean;source:WorkPackageProposalSource;target:'GITHUB_WP_PROPOSAL';state:AutonomousProposalState};
export const DEFAULT_PRODUCTION_WP_SOURCE:WorkPackageProposalSource='GITHUB';
export function proposalTransition(from:AutonomousProposalState,to:AutonomousProposalState){if(from==='SUGGESTED'&&to==='SYNCED_TO_WP')throw new Error('OWNER_REVIEW_REQUIRED_BEFORE_SYNC');if(from==='SUGGESTED'&&to==='SYNCED_TO_WP')return false;return true}
export function exportProposal(boundary:ProposalExportBoundary):ProposalExportBoundary{if(!boundary.ownerConfirmed)throw new Error('OWNER_CONFIRMATION_REQUIRED');if(boundary.source!=='AICC_SUGGESTION')throw new Error('INVALID_PROPOSAL_SOURCE');return {...boundary,state:'EXPORTED'}}
export function proposalSourceGovernance(){return {canSuggest:true,canAnalyze:true,canExplain:true,canCreateProductionWp:false,canActivate:false,canExecute:false,canApproveSelf:false}}
