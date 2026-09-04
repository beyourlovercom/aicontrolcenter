import type {DecisionRiskBaseline} from './decisionRiskBaseline.ts';
export type DecisionContext={origin:string;title?:string;scope?:string};
export type PolicyResult={approval_requirement:string;execution_mode?:string;approval_required?:boolean};
export type DecisionExplanation={summary:string;decision_reason:string;risk_explanation:string;governance_explanation:string;impact_scope:string;constraints:string[];next_action:string};
export class DecisionExplanationEngine{
  explain(context:DecisionContext,risk:DecisionRiskBaseline,policy:PolicyResult):DecisionExplanation{
    const multi=risk.risk_factors.includes('Multi Repository'),platform=risk.scope==='PLATFORM';
    const impact=[platform?'Platform':'',multi?'Multi Repository':risk.scope].filter(Boolean).join(' / ');
    const summary=platform?'New platform capability requires controlled review.':`${risk.risk_level} risk change requires controlled review.`;
    const decision_reason=`${context.origin==='AI_GENERATED'?'AI generated Work Package':'Work Package'} introduces ${impact||risk.scope.toLowerCase()} capability.`;
    const risk_explanation=`${risk.risk_level} risk because this change affects ${impact||risk.scope.toLowerCase()} scope. Factors: ${risk.risk_factors.join(', ')}.`;
    const governed=policy.approval_requirement==='OWNER_REVIEW_REQUIRED';
    const governance_explanation=governed?'AI may prepare this change but cannot approve or execute itself.':'Execution follows the applicable policy constraints.';
    return {summary,decision_reason,risk_explanation,governance_explanation,impact_scope:impact||risk.scope,constraints:['AICC_DECISION_AUTHORITY = 0',...risk.risk_factors],next_action:governed?'Owner review required.':'Proceed only within policy.'};
  }
}
export function explanationGovernance(){return {canExplain:true,canSummarize:true,canReason:true,canApprove:false,canModifyDecision:false,canExecute:false}}
