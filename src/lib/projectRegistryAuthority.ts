import {execFile,execFileSync} from 'node:child_process';
import {readFileSync,realpathSync,renameSync,writeFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {promisify} from 'node:util';

export const PROJECT_REGISTRY_FILE=join('docs','10_Planning_Roadmap','04_AICC_PROJECT_REGISTRY.json');
export const PROJECT_REGISTRY_AUTHORITY='PROJECT_REGISTRY_AUTHORITY_V1' as const;
export const ACTIVE_PROJECT_AUTHORITY='PROJECT_REGISTRY_AUTHORITY_V1' as const;
export const PROJECT_REGISTRY_GIT_TIMEOUT_MS=750;
export type ProjectRecord=Readonly<{projectId:string;displayName:string;repositoryPath:string;repositoryIdentity:string;remoteOrigin:string|null;currentBranch:string;defaultBranch:string;roadmapPath:string}>;
export type ProjectRegistryState=Readonly<{schema:'aicc.project-registry.v1';activeProjectId:string;projectContextRevision:number;projects:readonly ProjectRecord[]}>;

const execFileAsync=promisify(execFile);
function git(root:string,args:string[]):string|null{try{const value=execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();return value||null}catch{return null}}
async function gitAsync(root:string,args:string[]):Promise<string|null>{try{const result=await execFileAsync('git',['-C',root,...args],{encoding:'utf8',timeout:PROJECT_REGISTRY_GIT_TIMEOUT_MS,maxBuffer:64*1024,windowsHide:true});const value=String(result.stdout).trim();return value||null}catch{return null}}
function identity(origin:string|null):string|null{if(!origin)return null;const matched=origin.replace(/^git@github\.com:/,'').replace(/^https:\/\/github\.com\//,'').replace(/\.git$/,'');return matched.includes('/')?matched:null}
function sameRepositoryRoot(left:string,right:string):boolean{try{return realpathSync.native(left)===realpathSync.native(right)}catch{return false}}
function validate(project:ProjectRecord):ProjectRecord{
  const gitRoot=git(project.repositoryPath,['rev-parse','--show-toplevel']);
  const currentBranch=git(project.repositoryPath,['branch','--show-current']);
  const remoteOrigin=git(project.repositoryPath,['config','--get','remote.origin.url']);
  const repositoryIdentity=identity(remoteOrigin);
  if(!gitRoot||!sameRepositoryRoot(gitRoot,project.repositoryPath)||!currentBranch||!repositoryIdentity)throw new Error('PROJECT_REPOSITORY_INVALID');
  const defaultRef=git(project.repositoryPath,['symbolic-ref','--short','refs/remotes/origin/HEAD']);
  return {...project,repositoryIdentity,remoteOrigin,currentBranch,defaultBranch:defaultRef?.replace(/^origin\//,'')??'NOT_AVAILABLE'};
}
async function validateAsync(project:ProjectRecord):Promise<ProjectRecord>{
  const gitRoot=await gitAsync(project.repositoryPath,['rev-parse','--show-toplevel']);
  const currentBranch=await gitAsync(project.repositoryPath,['branch','--show-current']);
  const remoteOrigin=await gitAsync(project.repositoryPath,['config','--get','remote.origin.url']);
  const repositoryIdentity=identity(remoteOrigin);
  if(!gitRoot||!sameRepositoryRoot(gitRoot,project.repositoryPath)||!currentBranch||!repositoryIdentity)throw new Error('PROJECT_REPOSITORY_INVALID');
  const defaultRef=await gitAsync(project.repositoryPath,['symbolic-ref','--short','refs/remotes/origin/HEAD']);
  return {...project,repositoryIdentity,remoteOrigin,currentBranch,defaultBranch:defaultRef?.replace(/^origin\//,'')??'NOT_AVAILABLE'};
}
function parse(file:string):ProjectRegistryState{const state=JSON.parse(readFileSync(file,'utf8')) as ProjectRegistryState;if(state.schema!=='aicc.project-registry.v1'||!Array.isArray(state.projects)||!state.projects.length)throw new Error('PROJECT_REGISTRY_INVALID');return state}
async function parseAsync(file:string):Promise<ProjectRegistryState>{const state=JSON.parse(await readFile(file,'utf8')) as ProjectRegistryState;if(state.schema!=='aicc.project-registry.v1'||!Array.isArray(state.projects)||!state.projects.length)throw new Error('PROJECT_REGISTRY_INVALID');return state}
function persist(file:string,state:ProjectRegistryState){const temporary=`${file}.tmp`;writeFileSync(temporary,JSON.stringify(state,null,2)+'\n');renameSync(temporary,file)}

export class ProjectRegistryAuthority{
  private readonly file:string;
  constructor(file=join(process.cwd(),PROJECT_REGISTRY_FILE)){this.file=file}
  getProjectRegistry():ProjectRegistryState{const state=parse(this.file);const projects=state.projects.map(validate);return {...state,projects}}
  async getProjectRegistryAsync():Promise<ProjectRegistryState>{const state=await parseAsync(this.file);const projects:ProjectRecord[]=[];for(const project of state.projects)projects.push(await validateAsync(project));return {...state,projects}}
  getProject(projectId:string):ProjectRecord|null{return this.getProjectRegistry().projects.find(project=>project.projectId===projectId)??null}
  getActiveProject():ProjectRecord{const state=this.getProjectRegistry();const project=state.projects.find(item=>item.projectId===state.activeProjectId);if(!project)throw new Error('ACTIVE_PROJECT_INVALID');return project}
  async getActiveProjectAsync():Promise<ProjectRecord>{const state=await this.getProjectRegistryAsync();const project=state.projects.find(item=>item.projectId===state.activeProjectId);if(!project)throw new Error('ACTIVE_PROJECT_INVALID');return project}
  setActiveProject(projectId:string):ProjectRegistryState{const state=this.getProjectRegistry();if(!state.projects.some(project=>project.projectId===projectId))throw new Error('PROJECT_NOT_REGISTERED');if(state.activeProjectId===projectId)return state;const next={...state,activeProjectId:projectId,projectContextRevision:state.projectContextRevision+1};persist(this.file,next);return next}
}

export function createProjectRegistryAuthority(file?:string){return new ProjectRegistryAuthority(file)}
