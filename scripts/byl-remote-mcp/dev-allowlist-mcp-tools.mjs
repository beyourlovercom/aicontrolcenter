/**
 * Proposed formal MCP tool specifications, NOT registered to the production MCP.
 * No generic command dispatch; runtime must separately authorize and register.
 */
const str=(pattern)=>({type:'string',pattern});
const sha64=str('^[a-f0-9]{64}$'),sha40=str('^[a-f0-9]{40}$');
const ident=str('^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$');
const fileSchema={
 type:'object',additionalProperties:false,required:['path','operation','beforeSha256','afterSha256'],
 properties:{path:{type:'string',enum:[
 'wp-content/plugins/yby-core/admin/class-yby-andy-os-navigation.php',
 'wp-content/plugins/yby-core/admin/class-yby-project-studio.php',
 'wp-content/plugins/yby-core/inc/class-yby-core.php'
 ]},operation:{type:'string',enum:['add','replace']},
 beforeSha256:{anyOf:[sha64,{type:'null'}]},afterSha256:sha64}
};
export const DEV_MANIFEST_SCHEMA=Object.freeze({
 type:'object',additionalProperties:false,
 required:['schema','environment','project','releaseId','requestId','authorizationReceipt','github','artifact','files'],
 properties:{
  schema:{type:'integer',const:1},environment:{type:'string',const:'dev'},
  project:{type:'string',const:'byl-wordpress-core'},releaseId:ident,requestId:ident,
  authorizationReceipt:ident,
  github:{type:'object',additionalProperties:false,required:['repo','commitSha','prNumber','ciRunId'],
   properties:{repo:{type:'string',const:'beyourlovercom/YBY-Core'},commitSha:sha40,
    prNumber:{type:'integer',minimum:1},ciRunId:{type:'integer',minimum:1}}},
  artifact:{type:'object',additionalProperties:false,required:['id','sha256'],
   properties:{id:ident,sha256:sha64}},
  files:{type:'array',minItems:1,maxItems:3,items:fileSchema}
 }
});
const requestInput={type:'object',additionalProperties:false,required:['manifest'],
 properties:{manifest:DEV_MANIFEST_SCHEMA}};
export const DEV_DEPLOY_TOOL_SPECS=Object.freeze([
 {name:'dev_release_prepare',description:'Prepare-only, verified artifact and backup; no live WordPress writes.',inputSchema:requestInput},
 {name:'dev_release_apply',description:'Owner-authorized Dev-only exact file apply with reattestation and rollback.',inputSchema:requestInput},
 {name:'dev_release_rollback',description:'Owner-authorized Dev-only exact release rollback.',inputSchema:requestInput},
 {name:'dev_release_status',description:'Read-only, redacted release status.',inputSchema:{type:'object',
  additionalProperties:false,required:['project','releaseId'],
  properties:{project:{type:'string',const:'byl-wordpress-core'},releaseId:ident}}}
]);
function deny(code){return {isError:true,content:[{type:'text',text:code}]};}
export function makeDevToolDispatcher({service,authorizeTool}={}){
 if(!service||typeof authorizeTool!=='function')throw Error('DEV_TOOL_NOT_CONFIGURED');
 for(const op of ['prepare','apply','rollback','status'])
   if(typeof service[op]!=='function')throw Error('DEV_SERVICE_NOT_CONFIGURED');
 return async function dispatch({name,arguments:args,principal}={}){
  const known=DEV_DEPLOY_TOOL_SPECS.find(x=>x.name===name);
  if(!known)return deny('TOOL_NOT_REGISTERED');
  if(!args||typeof args!=='object'||Array.isArray(args))return deny('ARGUMENTS_DENIED');
  const isStatus=name==='dev_release_status';
  if(Object.keys(args).sort().join(',')!==(isStatus?'project,releaseId':'manifest'))
    return deny('ARGUMENTS_DENIED');
  let allowed=false;
  try{allowed=await authorizeTool({name,principal,scope:isStatus?args:args.manifest});}catch{}
  if(allowed!==true)return deny('OPERATOR_AUTH_DENIED');
  try{
   const operation=name.slice('dev_release_'.length);
   const result=await service[operation](isStatus?{...args,principal}:args.manifest);
   // Stable, bounded, non-sensitive receipt fields only.
   if(result===null)return {content:[{type:'text',text:'NOT_FOUND'}]};
   const safe={project:result.project,releaseId:result.releaseId,state:result.state,digest:result.digest};
   return {content:[{type:'text',text:JSON.stringify(safe)}]};
  }catch(error){
   const code=typeof error?.code==='string'&&/^[A-Z0-9_]{3,64}$/.test(error.code)
     ?error.code:'DEPLOY_ERROR';
   return deny(code);
  }
 };
}
