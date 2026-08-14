import assert from "node:assert/strict";
import {buildOwnerGitDeliveryEnvironment, redactSecret, resolveGitHubCredential, stripGitHubCredentialEnvironment} from "./gitCredentialBridge.ts";

const base={HOME:"/Users/a",PATH:"/opt/homebrew/bin",GH_TOKEN:"stale",GITHUB_TOKEN:"stale-too"};
const normal=stripGitHubCredentialEnvironment(base);
assert.equal(normal.GH_TOKEN,undefined);
assert.equal(normal.GITHUB_TOKEN,undefined);

const calls:string[][]=[];
const token=resolveGitHubCredential(base,(file,args,options)=>{
  calls.push([file,...args,options.env.GH_TOKEN??"NOT_SET"]);
  if(args[0]==="auth")return "ephemeral-token\n";
  assert.equal(options.env.GH_TOKEN,"ephemeral-token");
  assert.equal(options.env.GITHUB_TOKEN,undefined);
  return "beyourlovercom\n";
});
assert.equal(token,"ephemeral-token");
assert.equal(calls[0].at(-1),"NOT_SET");
assert.equal(calls[1].at(-1),"ephemeral-token");
const owner=buildOwnerGitDeliveryEnvironment(normal,token);
assert.equal(owner.GH_TOKEN,"ephemeral-token");
assert.equal(owner.GITHUB_TOKEN,undefined);

assert.throws(()=>resolveGitHubCredential({},()=>{throw new Error("lookup failed");}),/GITHUB_CREDENTIAL_CAPABILITY_UNAVAILABLE/);
assert.equal(redactSecret(`gh output ephemeral-token`,token),'gh output [REDACTED_GITHUB_CREDENTIAL]');
assert.equal(JSON.stringify({phase:'RUNNING',environment:'GH_TOKEN = SET'}).includes(token),false);
console.log('git credential bridge isolation matrix passed');
