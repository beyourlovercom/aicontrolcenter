function fail(code){const e=new Error(code);e.code=code;throw e;}

export class RemoteRunnerClient{
  constructor(baseUrl,fetcher=fetch){this._base=baseUrl;this._fetch=fetcher;}
  async _call(path,init={}){
    let res;
    try{res=await this._fetch(`${this._base}${path}`,{...init,headers:{'content-type':'application/json',...(init.headers||{})}});}
    catch{fail('REMOTE_RUNNER_UNREACHABLE');}
    let body={};try{body=await res.json();}catch{}
    if(!res.ok){const code=body?.errorCode||`REMOTE_RUNNER_HTTP_${res.status}`;fail(code);}
    return body;
  }
  health(){return this._call('/v1/health');}
  status(){return this._call('/v1/status');}
  submit(envelope){return this._call('/v1/executions',{method:'POST',body:JSON.stringify(envelope)});}
  get(executionId){return this._call(`/v1/executions/${encodeURIComponent(executionId)}`);}
}

/** Base URL from AICC_RUNNER_HOST + AICC_RUNNER_PORT. Returns null when host is absent. */
export function remoteRunnerBaseUrl(env=process.env){
  const host=env.AICC_RUNNER_HOST?.trim();
  const port=env.AICC_RUNNER_PORT||'8787';
  if(!host)return null;
  return `http://${host}:${port}`;
}

/**
 * Explicit remote repository root from AICC_REMOTE_CLAUDE_REPOSITORY_ROOT.
 * This is the filesystem path on the runner machine — never inferred from
 * the local context. Returns null when not set; callers must fail closed.
 */
export function remoteRepositoryRoot(env=process.env){
  const root=env.AICC_REMOTE_CLAUDE_REPOSITORY_ROOT?.trim();
  return root||null;
}
