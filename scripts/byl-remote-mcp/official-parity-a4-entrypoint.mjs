#!/usr/bin/env node
/**
 * Exact-service launchd executable. No private configuration is stored here.
 *
 * Only launch this entrypoint after service-owner approval and explicit
 * BYL_MCP_A4_SERVICE_LAUNCH_ENABLED=1 in the private launchd environment.
 *
 * If current OAuth occupies 8797, this exits with failure rather than killing
 * it. Only the service owner may perform the existing service switch.
 */
import {launchA4OAuthService} from './official-parity-a4-launcher.mjs';

try{
 const service=await launchA4OAuthService();
 if(service.status!=='SERVICE_LISTENING')throw Error('A4_SERVICE_NOT_LISTENING');
 // Does not expose key, token, target addresses, private file paths or JWT.
 process.stdout.write('A4_OAUTH_SERVICE_LISTENING\n');
 const close=()=>service.listener.close(()=>{process.exitCode=0;});
 process.once('SIGTERM',close);
 process.once('SIGINT',close);
}catch{
 process.stderr.write('A4_OAUTH_SERVICE_START_FAILED\n');
 process.exitCode=1;
}
