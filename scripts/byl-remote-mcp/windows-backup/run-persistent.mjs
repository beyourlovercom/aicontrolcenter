import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const home=process.env.USERPROFILE;
if(!home)throw Error('WINDOWS_USERPROFILE_REQUIRED');
const privateDir=join(home,'.byl-mcp-backup');
const config=JSON.parse(readFileSync(join(privateDir,'owner-access.json'),'utf8'));
const allowed=new Set(['BYL_WIN_PUBLIC_HOST','BYL_WIN_ACCESS_ISSUER','BYL_WIN_ACCESS_AUDIENCE','BYL_WIN_ACCESS_OWNER']);
if(Object.keys(config).length!==allowed.size||Object.keys(config).some(k=>!allowed.has(k)))throw Error('BACKUP_ACCESS_CONFIG_KEYS_INVALID');
if(config.BYL_WIN_PUBLIC_HOST!=='mcp-win-uat.beyourlover.com'||config.BYL_WIN_ACCESS_ISSUER!=='https://idollri.cloudflareaccess.com'||!/^[a-f0-9]{64}$/.test(config.BYL_WIN_ACCESS_AUDIENCE))throw Error('BACKUP_ACCESS_CONFIG_INVALID');
if(config.BYL_WIN_ACCESS_OWNER!=='andyisless@gmail.com,svakomandy@gmail.com')throw Error('BACKUP_ACCESS_OWNER_MISMATCH');
Object.assign(process.env,config,{
 BYL_WIN_BACKUP_ROOT:join(home,'AI'),
 BYL_WIN_BACKUP_TOKEN_FILE:join(privateDir,'gateway.token')
});
await import('./windows-gateway.mjs');
