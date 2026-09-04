export function selectCanonicalCurrentRuntime<T extends {runId:string;phase:string;lastActivityAt?:string;startedAt?:string}>(current:T|null,history:T[],selectedRunId?:string|null):T|null {
  const candidates=[current,...history].filter((item):item is T=>Boolean(item));
  const selected=selectedRunId?candidates.find(item=>item.runId===selectedRunId):null;
  if(selected&&['STARTING','RUNNING','STOPPING'].includes(selected.phase))return selected;
  const active=candidates.filter(item=>['STARTING','RUNNING','STOPPING'].includes(item.phase)).sort((a,b)=>Date.parse(b.lastActivityAt??b.startedAt??'')-Date.parse(a.lastActivityAt??a.startedAt??''));
  if(active[0])return active[0];
  if(selected)return selected;
  if(current)return current;
  return history[0]??null;
}
