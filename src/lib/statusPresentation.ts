import type {AiccStatus} from './workflow.ts';

export type AiccPresentationStatus=AiccStatus|'ABSENT'|'UNAVAILABLE'|'UNKNOWN';
export type AiccStatusColorToken='status-gray'|'status-blue'|'status-green'|'status-amber'|'status-red'|'status-purple';
export type StatusPresentationMeta={code:AiccPresentationStatus;colorToken:AiccStatusColorToken;ownerLabel:string;shortDescription:string;tooltipDescription:string};

export const statusPresentationRegistry:Record<AiccPresentationStatus,StatusPresentationMeta>={
  NOT_STARTED:{code:'NOT_STARTED',colorToken:'status-gray',ownerLabel:'未开始',shortDescription:'尚未开始推进',tooltipDescription:'当前项目尚未进入执行阶段。'},
  IN_PROGRESS:{code:'IN_PROGRESS',colorToken:'status-blue',ownerLabel:'进行中',shortDescription:'正在执行',tooltipDescription:'当前项目已经开始推进，系统或执行 Agent 正在处理相关工作。'},
  WAITING_OWNER:{code:'WAITING_OWNER',colorToken:'status-amber',ownerLabel:'等待 Owner',shortDescription:'等待人工确认',tooltipDescription:'当前项目需要 Owner 确认、授权或人工操作后才能继续推进。'},
  WAITING_UAT:{code:'WAITING_UAT',colorToken:'status-amber',ownerLabel:'等待人工 UAT',shortDescription:'等待人工验收',tooltipDescription:'当前实现已进入人工验收阶段，需要 Owner 完成 UI/UAT 检查后才能继续。'},
  PASS:{code:'PASS',colorToken:'status-green',ownerLabel:'通过',shortDescription:'验证通过',tooltipDescription:'当前阶段已经通过所要求的验证或验收。'},
  COMPLETE:{code:'COMPLETE',colorToken:'status-green',ownerLabel:'已完成',shortDescription:'工作已完成',tooltipDescription:'当前项目或阶段已经完成，所需交付条件已经满足。'},
  FAILED:{code:'FAILED',colorToken:'status-red',ownerLabel:'失败',shortDescription:'执行失败',tooltipDescription:'当前项目或阶段发生失败，需要处理错误后才能继续。'},
  BLOCKED:{code:'BLOCKED',colorToken:'status-red',ownerLabel:'已阻塞',shortDescription:'存在阻塞项',tooltipDescription:'当前项目存在明确阻塞条件，在阻塞解除前无法继续推进。'},
  SKIPPED:{code:'SKIPPED',colorToken:'status-purple',ownerLabel:'已跳过',shortDescription:'本阶段已跳过',tooltipDescription:'根据当前执行路径，本阶段无需执行或被明确跳过。'},
  N_A:{code:'N_A',colorToken:'status-purple',ownerLabel:'不适用',shortDescription:'当前阶段不适用',tooltipDescription:'该阶段不适用于当前实体或当前执行路径。'},
  ABSENT:{code:'ABSENT',colorToken:'status-gray',ownerLabel:'无记录',shortDescription:'当前没有对应数据',tooltipDescription:'当前上下文中没有对应记录或证据，这并不表示执行失败。'},
  UNAVAILABLE:{code:'UNAVAILABLE',colorToken:'status-gray',ownerLabel:'不可用',shortDescription:'当前能力不可用',tooltipDescription:'当前能力、数据源或运行环境暂时不可用，但这与执行失败不同。'},
  UNKNOWN:{code:'UNKNOWN',colorToken:'status-gray',ownerLabel:'未知状态',shortDescription:'状态未映射',tooltipDescription:'当前状态尚未映射到受支持的展示语义。'}
};

const aliases:Record<string,AiccPresentationStatus>={
  PLANNED:'NOT_STARTED',READY:'NOT_STARTED',IMPLEMENTATION:'IN_PROGRESS',RUNNING:'IN_PROGRESS',STARTING:'IN_PROGRESS',STOPPING:'IN_PROGRESS',
  OWNER_AUTHORIZATION:'WAITING_OWNER',READY_FOR_OWNER_AUTHORIZATION:'WAITING_OWNER',HUMAN_UAT:'WAITING_UAT',
  DELIVERY_READY:'NOT_STARTED',COMPLETED:'COMPLETE',CLOSED:'COMPLETE'
};

export function resolvePresentationStatus(raw:string|null|undefined):AiccPresentationStatus{
  if(raw===null||raw===undefined||raw.trim()==='') return 'ABSENT';
  const value=raw.trim().toUpperCase();
  if(value in statusPresentationRegistry) return value as AiccPresentationStatus;
  return aliases[value]??'UNKNOWN';
}

export function getStatusPresentationMeta(raw:string|null|undefined){return statusPresentationRegistry[resolvePresentationStatus(raw)];}
