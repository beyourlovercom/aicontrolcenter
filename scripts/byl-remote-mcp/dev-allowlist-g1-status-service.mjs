/**
 * G1 bootstrap status service only. Zero filesystem, network and process I/O.
 * State NOT_ENABLED is an explicit "no Dev deployment channel" acknowledgment,
 * not a release receipt and never a claim about real Hostinger state.
 *
 * G2 durable journal / Dev filesystem adapters MUST NOT be injected here.
 */
const RELEASE_ID=/^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/;
function deny(code){throw Object.assign(new Error(code),{code});}

export function createG1StatusOnlyService(){
 const mutation=async()=>deny('G1_MUTATION_DISABLED');
 return Object.freeze({
  async status({project,releaseId,principal}={}){
   if(project!=='byl-wordpress-core'||typeof releaseId!=='string'||
      !RELEASE_ID.test(releaseId)||releaseId==='.'||releaseId==='..')
      deny('G1_STATUS_SCOPE_DENIED');
   if(!principal||typeof principal!=='object'||Array.isArray(principal))
      deny('G1_STATUS_AUTH_REQUIRED');
   // Real OAuth principal and operator policy are independently enforced by
   // the MCP registration adapter before this function executes.
   return Object.freeze({project,releaseId,state:'NOT_ENABLED',digest:null});
  },
  prepare:mutation,apply:mutation,rollback:mutation,
 });
}
