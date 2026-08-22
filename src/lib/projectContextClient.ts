export type BrowserProjectRecord=Readonly<{projectId:string;displayName:string;repositoryPath:string;repositoryIdentity:string;remoteOrigin:string|null;currentBranch:string;defaultBranch:string;roadmapPath:string}>;
export type BrowserProjectRegistryState=Readonly<{schema:'aicc.project-registry.v1';activeProjectId:string;projectContextRevision:number;projects:readonly BrowserProjectRecord[]}>;
export type BrowserProjectContextResponse=Readonly<{registry:BrowserProjectRegistryState;activeProject:BrowserProjectRecord}>;

function isProject(value:unknown):value is BrowserProjectRecord{
  if(!value||typeof value!=='object')return false;
  const record=value as Record<string,unknown>;
  return ['projectId','displayName','repositoryPath','repositoryIdentity','currentBranch','defaultBranch','roadmapPath'].every(key=>typeof record[key]==='string');
}

export async function readBrowserProjectContext(fetcher:typeof fetch=fetch):Promise<BrowserProjectContextResponse>{
  const response=await fetcher('/api/project-context',{cache:'no-store'});
  if(!response.ok)throw new Error(`PROJECT_CONTEXT_HTTP_${response.status}`);
  const payload=await response.json() as Partial<BrowserProjectContextResponse>;
  if(!payload.registry||payload.registry.schema!=='aicc.project-registry.v1'||!Array.isArray(payload.registry.projects)||!isProject(payload.activeProject))throw new Error('PROJECT_CONTEXT_INVALID');
  return payload as BrowserProjectContextResponse;
}
