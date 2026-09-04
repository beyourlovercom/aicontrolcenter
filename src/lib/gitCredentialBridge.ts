import {execFileSync} from "node:child_process";

type CredentialExec = (file:string,args:string[],options:{encoding:"utf8";env:NodeJS.ProcessEnv;stdio:["ignore","pipe","pipe"];timeout?:number})=>string|Buffer;

const githubHost = "github.com";

export function stripGitHubCredentialEnvironment(base:NodeJS.ProcessEnv):NodeJS.ProcessEnv {
  const environment = {...base};
  delete environment.GH_TOKEN;
  delete environment.GITHUB_TOKEN;
  return environment;
}

export function buildOwnerGitDeliveryEnvironment(base:NodeJS.ProcessEnv, token:string):NodeJS.ProcessEnv {
  const environment = stripGitHubCredentialEnvironment(base);
  environment.GH_TOKEN = token;
  return environment;
}

export function resolveGitHubCredential(
  base:NodeJS.ProcessEnv = process.env,
  run:CredentialExec = execFileSync as unknown as CredentialExec,
):string {
  const lookupEnvironment = stripGitHubCredentialEnvironment(base);
  let token:string;
  try {
    token = String(run("gh",["auth","token","-h",githubHost],{encoding:"utf8",env:lookupEnvironment,stdio:["ignore","pipe","pipe"]})).trim();
  } catch {
    throw new Error("GITHUB_CREDENTIAL_CAPABILITY_UNAVAILABLE");
  }
  if (!token) throw new Error("GITHUB_CREDENTIAL_CAPABILITY_UNAVAILABLE");
  try {
    run("gh",["api","user","--hostname",githubHost,"--jq",".login"],{encoding:"utf8",env:buildOwnerGitDeliveryEnvironment(lookupEnvironment,token),stdio:["ignore","pipe","pipe"]});
  } catch {
    throw new Error("GITHUB_CREDENTIAL_CAPABILITY_UNAVAILABLE");
  }
  return token;
}

export function redactSecret(value:string|undefined, secret:string|undefined):string|undefined {
  if (value === undefined || !secret) return value;
  return value.split(secret).join("[REDACTED_GITHUB_CREDENTIAL]");
}
