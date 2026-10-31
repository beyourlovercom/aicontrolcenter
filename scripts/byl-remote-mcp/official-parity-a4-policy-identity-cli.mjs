#!/usr/bin/env node
/**
 * Trusted service-owner LOCAL read-only check. It reads only a supplied A4
 * private manifest and its selected policy file; no imports, writes, network
 * calls, service restarts, secret logging or private path output.
 *
 * Required private environment values (never pass their paths to a public
 * GitHub issue or assistant):
 *  BYL_MCP_A4_PRIVATE_MANIFEST_FILE
 *  BYL_MCP_INSPECTED_POLICY_SHA256
 *
 * IMPORTANT: even a match proves only manifest resolution, not that the
 * currently running launchd listener loaded that exact manifest.
 */
import {inspectA4PolicyIdentity} from './official-parity-a4-policy-identity.mjs';
try{
 if(!process.env.BYL_MCP_A4_PRIVATE_MANIFEST_FILE)
  throw Error('POLICY_IDENTITY_MANIFEST_ENV_MISSING');
 const report=inspectA4PolicyIdentity({
  manifestFile:process.env.BYL_MCP_A4_PRIVATE_MANIFEST_FILE,
  inspectedSha256:process.env.BYL_MCP_INSPECTED_POLICY_SHA256
 });
 process.stdout.write(JSON.stringify(report)+'\n');
 if(!report.inspectedFileMatchesManifestPolicy)process.exitCode=2;
}catch(e){
 const allowed=new Set([
  'POLICY_IDENTITY_EXPECTED_SHA_REQUIRED',
  'POLICY_IDENTITY_MANIFEST_ENV_MISSING',
  'POLICY_IDENTITY_MANIFEST_INVALID',
  'POLICY_IDENTITY_MANIFEST_NOT_FOUND',
  'POLICY_IDENTITY_MANIFEST_NOT_ACCESSIBLE',
  'POLICY_IDENTITY_RUNTIME_DIRECTORY_NOT_FOUND',
  'POLICY_IDENTITY_RUNTIME_DIRECTORY_NOT_ACCESSIBLE',
  'POLICY_IDENTITY_POLICY_NOT_FOUND',
  'POLICY_IDENTITY_POLICY_NOT_ACCESSIBLE',
  'POLICY_IDENTITY_MANIFEST_INSECURE',
  'POLICY_IDENTITY_RUNTIME_DIRECTORY_INSECURE',
  'POLICY_IDENTITY_POLICY_INVALID'
 ]);
 process.stdout.write(JSON.stringify({
  status:'UNVERIFIED',code:allowed.has(e?.message)?e.message:'POLICY_IDENTITY_UNAVAILABLE'
 })+'\n');
 process.exitCode=1;
}
