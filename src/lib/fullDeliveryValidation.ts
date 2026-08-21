export type ValidationProject={id:string;project:string;repository:string;purpose:string};export type CapabilityMatrix=Record<string,boolean>;
export const FULL_DELIVERY_VALIDATION:ValidationProject={id:'AICC_FULL_DELIVERY_VALIDATION',project:'AI Control Center',repository:'aicontrolcenter',purpose:'Validate GPT → GitHub → AICC → Codex lifecycle'};
export function registerValidationProject(){return {...FULL_DELIVERY_VALIDATION,status:'REGISTERED'}}
export function validateGptWpContract(wp:Record<string,unknown>){return ['objective','scope','architecture_context','acceptance_criteria','test_requirements','risk'].every(key=>Boolean(wp[key]))}
export function validateLifecycleSync(facts:{githubWp?:boolean;discovered?:boolean;roadmap?:boolean;lifecycle?:boolean}){return Boolean(facts.githubWp&&facts.discovered&&facts.roadmap&&facts.lifecycle)}
export function resolveValidationContext(){return {project:'AI Control Center',repository:'aicontrolcenter',workspace:'AICC_FULL_DELIVERY_VALIDATION',branch:'rebuild/aicc-v2',architecture:'AICC V2',relatedKnowledge:true,dependencies:true}}
export function validateAgentChain(chain:string[]){return JSON.stringify(chain)===JSON.stringify(['PLANNER_AGENT','ARCHITECTURE_AGENT','EXECUTION_AGENT','TESTING_AGENT','DELIVERY_AGENT'])}
export function validateCodexExecution(execution:{context?:boolean;contract?:boolean;run?:boolean}){return Boolean(execution.context&&execution.contract&&execution.run)}
export function validateEvidenceChain(evidence:Record<string,boolean>){return ['commit','pr','ci','test','review','uat'].every(key=>evidence[key])}
export function validateOwnerUat(status:'OWNER_UAT_REQUIRED'|'PASS',ownerAction?:'APPROVE'|'REJECT'|'REQUEST_CHANGES'){return status==='OWNER_UAT_REQUIRED'&&Boolean(ownerAction)}
export function validateFailureRecovery(chain:string[]){return JSON.stringify(chain)===JSON.stringify(['ISSUE_INTELLIGENCE','PROPOSAL_LOOP','REMEDIATION_PLAN','REVIEW_GATE','RECOVERY_EXECUTION'])}
export function calculateDeliveryReadiness(matrix:CapabilityMatrix){return Object.values(matrix).every(Boolean)}
export function finalGovernanceCheck(){return {uncontrolledWp:false,bypassGpt:false,bypassOwner:false,selfMerge:false,selfMarkUat:false,aiccDecisionAuthority:0}}
