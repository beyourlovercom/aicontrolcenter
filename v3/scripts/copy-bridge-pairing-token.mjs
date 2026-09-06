import {spawnSync} from 'node:child_process';
import {ensureBridgeCredential} from '../lib/bridge-store.mjs';

if(process.platform!=='darwin'){
  console.error('AICC Bridge pairing clipboard helper currently requires macOS.');
  process.exit(2);
}
const token=ensureBridgeCredential(process.env);
const result=spawnSync('/usr/bin/pbcopy',[],{input:token,encoding:'utf8'});
if(result.status!==0){console.error('Failed to copy AICC Bridge pairing token to clipboard.');process.exit(1);}
console.log('AICC Bridge pairing token copied to clipboard.');
