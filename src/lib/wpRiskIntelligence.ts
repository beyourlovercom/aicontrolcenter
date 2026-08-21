export type WpRiskLevel='LOW'|'MEDIUM'|'HIGH';
export type WpRiskFactor='UI_CHANGE'|'SINGLE_MODULE_CHANGE'|'DATABASE_CHANGE'|'ARCHITECTURE_CHANGE'|'MULTI_REPOSITORY'|'DELIVERY_PIPELINE'|'GOVERNANCE_CHANGE'|'PLATFORM_CHANGE';
export type WpRiskIntelligence={risk_level:WpRiskLevel;risk_score:number;risk_factors:WpRiskFactor[];reason:string};
export const RISK_FACTOR_WEIGHTS:Record<WpRiskFactor,number>={UI_CHANGE:10,SINGLE_MODULE_CHANGE:20,DATABASE_CHANGE:40,ARCHITECTURE_CHANGE:50,MULTI_REPOSITORY:50,DELIVERY_PIPELINE:50,GOVERNANCE_CHANGE:60,PLATFORM_CHANGE:60};
const rules:[RegExp,WpRiskFactor][]=[
  [/repository|repositories|multi\s*repo|workspace|多仓库/i,'MULTI_REPOSITORY'],
  [/architecture|framework|migration|架构|迁移/i,'ARCHITECTURE_CHANGE'],
  [/platform|平台/i,'PLATFORM_CHANGE'],
  [/\bpr\b|\bci\b|release|deployment|delivery|发布|部署|交付/i,'DELIVERY_PIPELINE'],
  [/policy|authorization|approval|lifecycle|权限|授权|审批|生命周期/i,'GOVERNANCE_CHANGE'],
  [/database|db|数据库/i,'DATABASE_CHANGE'],
  [/feature|module|功能|模块/i,'SINGLE_MODULE_CHANGE'],
  [/ui|interface|页面|界面/i,'UI_CHANGE']
];
export function assessWpRisk(scope:string):WpRiskIntelligence{const factors:WpRiskFactor[]=[];for(const [pattern,factor] of rules)if(pattern.test(scope)&&!factors.includes(factor))factors.push(factor);const risk_score=Math.min(1000,factors.reduce((sum,factor)=>sum+RISK_FACTOR_WEIGHTS[factor],0));const risk_level:WpRiskLevel=risk_score>=80||factors.includes('GOVERNANCE_CHANGE')?'HIGH':risk_score>=20?'MEDIUM':'LOW';const reason=factors.includes('MULTI_REPOSITORY')&&factors.includes('PLATFORM_CHANGE')?'Cross repository platform architecture capability':factors.length?factors.join(' + '):'Isolated, low-impact change';return {risk_level,risk_score,risk_factors:factors,reason}}
export function riskIntelligenceGovernance(){return {canClassify:true,canScore:true,canExplain:true,canRecommend:true,canApprove:false,canExecute:false,canOverrideOwner:false}}
