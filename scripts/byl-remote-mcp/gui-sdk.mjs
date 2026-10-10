import {createRequire} from 'node:module';
export function resolveMcpSdk({requireFn=createRequire(import.meta.url)}={}){
 try{return requireFn.resolve('@modelcontextprotocol/sdk/package.json');}
 catch{return null;}
}
export function requireSdkPath(){
 const pkg=resolveMcpSdk();
 if(!pkg)throw Error('MCP_SDK_DEPENDENCY_MISSING');
 return pkg;
}
