/**
 * LaunchAgent entrypoint for supervised OAuth compatibility port 8797.
 * No secrets in plist / GitHub. Requires 0600 owner-owned JSON config.
 */
import {loadOAuthCompatConfig} from './oauth-compat-persistent-config.mjs';
const file=process.env.BYL_MCP_CONFIG_PATH;
if(!file)throw Error('OAUTH_CONFIG_PATH_REQUIRED');
const config=loadOAuthCompatConfig(file);
Object.assign(process.env,config);
await import('./mcp-endpoint.mjs');
