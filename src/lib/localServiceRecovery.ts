export type LocalServiceClassification='HEALTHY_CANONICAL_SERVICE'|'STALE_CANONICAL_SERVICE'|'FOREIGN_PORT_CONFLICT'|'NO_SERVICE'|'STARTING';
export type ServiceObservation={listener:null|{pid:number;command:string;cwd:string};health:{responded:boolean;canonicalIdentity:boolean;ok:boolean};consecutiveHealthFailures:number;repositoryRoot:string};
export function isCanonicalListener(observation:ServiceObservation):boolean{
  const listener=observation.listener;
  return Boolean(listener&&listener.cwd===observation.repositoryRoot&&/node_modules\/\.bin\/vite|vite .*127\.0\.0\.1/.test(listener.command));
}
export function classifyLocalService(observation:ServiceObservation):LocalServiceClassification{
  if(!observation.listener)return 'NO_SERVICE';
  if(!isCanonicalListener(observation))return 'FOREIGN_PORT_CONFLICT';
  if(observation.health.responded&&observation.health.canonicalIdentity&&observation.health.ok)return 'HEALTHY_CANONICAL_SERVICE';
  return observation.consecutiveHealthFailures>=2?'STALE_CANONICAL_SERVICE':'STARTING';
}
export function recoveryActions(classification:LocalServiceClassification):string[]{
  if(classification==='STALE_CANONICAL_SERVICE')return ['VERIFY_CANONICAL_IDENTITY','SIGTERM','BOUNDED_WAIT','REVERIFY_CANONICAL_IDENTITY','SIGKILL_IF_NEEDED','WAIT_FOR_LAUNCHD','POLL_CANONICAL_HEALTH'];
  if(classification==='NO_SERVICE')return ['WAIT_FOR_LAUNCHD','POLL_CANONICAL_HEALTH'];
  if(classification==='FOREIGN_PORT_CONFLICT')return ['REPORT_PORT_1420_CONFLICT'];
  return classification==='STARTING'?['POLL_CANONICAL_HEALTH']:[];
}
export function reconnectEffect(previous:LocalServiceClassification,current:LocalServiceClassification){return {showRecovery:current==='STALE_CANONICAL_SERVICE'||current==='STARTING'||current==='NO_SERVICE',refreshSnapshot:previous!=='HEALTHY_CANONICAL_SERVICE'&&current==='HEALTHY_CANONICAL_SERVICE',preserveSelection:true};}
