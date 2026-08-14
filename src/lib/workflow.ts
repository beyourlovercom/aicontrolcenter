export type AiccStatus='NOT_STARTED'|'IN_PROGRESS'|'PASS'|'COMPLETE'|'WAITING_OWNER'|'WAITING_UAT'|'BLOCKED'|'FAILED'|'SKIPPED'|'N_A';
export type RoadmapNodeType='milestone'|'work_package'|'pull_request';
export type RoadmapNode={id:string;type:RoadmapNodeType;title:string;status:AiccStatus;progress:number|null;parentId:string|null;children:RoadmapNode[];subtitle?:string};
export const wpStages=[['PLANNED','规划'],['READY','准备'],['OWNER_AUTHORIZATION','授权'],['IMPLEMENTATION','实现'],['VALIDATION','验证'],['REVIEW','Review'],['DELIVERY','交付'],['HUMAN_UAT','UAT'],['CLOSED','完成']] as const;
export const prStages=[['DELIVERY_READY','交付准备'],['COMMIT','Commit'],['PUSH','Push'],['DRAFT_PR','Draft PR'],['EXACT_HEAD_CI','Exact-head CI'],['READY_TO_MERGE','Ready'],['MERGE_AND_VERIFY','Merge / Verify']] as const;
export function statusText(status:AiccStatus){return ({NOT_STARTED:'未开始',IN_PROGRESS:'正在执行',PASS:'已通过',COMPLETE:'已完成',WAITING_OWNER:'等待 Owner',WAITING_UAT:'等待人工 UAT',BLOCKED:'阻塞',FAILED:'失败',SKIPPED:'跳过',N_A:'不适用'})[status]}
export function statusClass(status:AiccStatus){return status.toLowerCase().replace('_','-')}
