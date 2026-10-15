/**
 * Official Parity V1 — signed device health using the V2.1 canonical library.
 * This file does not start a listener or probe arbitrary URLs.
 * Operator wires a fixed-target transport and pinned device public keys.
 */
import {createLiveHealthMonitor} from './remote-v2-live-health.mjs';
import {createSignedDeviceProbe} from './remote-v2-signed-health.mjs';
export const PARITY_DEVICES=Object.freeze([
 'us-macmini','china-mac','windows','007windows'
]);
const deny=code=>({isError:true,content:[{type:'text',text:code}]});
const text=result=>({content:[{type:'text',text:JSON.stringify(result)}]});
export function createParitySignedMonitor({
  transport,publicKeys,clock=Date.now,nonceSource,
  ttlMs=15000,timeoutMs=2500
}={}){
 if(typeof transport!=='function'||!publicKeys||typeof publicKeys!=='object'||
    PARITY_DEVICES.some(id=>!Object.hasOwn(publicKeys,id)))
  throw Error('PARITY_SIGNED_HEALTH_REQUIRED');
 const registry=Object.freeze(Object.fromEntries(
  PARITY_DEVICES.map(id=>[id,Object.freeze({id})])
 ));
 const probeDevice=createSignedDeviceProbe({transport,publicKeys,clock,nonceSource});
 return createLiveHealthMonitor({
  registry,probeDevice,clock,ttlMs,timeoutMs,maxConcurrency:3
 });
}
export function registerParityHealthTools({
 server,z,principal,authorizeHealth,monitor
}={}){
 if(typeof server?.registerTool!=='function'||typeof z?.enum!=='function'||
    !principal||principal.kind!=='cloudflare-access'||principal.canOperate!==true||
    typeof authorizeHealth!=='function'||
    typeof monitor?.list!=='function'||typeof monitor?.check!=='function')
  throw Error('PARITY_HEALTH_REGISTRATION_DENIED');
 const authorized=async(deviceId,action)=>{
  try{return (await authorizeHealth({principal,deviceId,action}))===true;}
  catch{return false;}
 };
 server.registerTool('dc_list_devices_live',{
  description:'Read-only signed health state for four self-hosted DC devices; configured does not mean reachable.',
  inputSchema:{}
 },async()=>{
  if(!(await authorized(null,'list')))return deny('PARITY_HEALTH_FORBIDDEN');
  try{return text(await monitor.list());}
  catch{return deny('PARITY_HEALTH_ERROR');}
 });
 server.registerTool('dc_ping',{
  description:'Read-only signed fresh health challenge for one approved DC device; never restarts it.',
  inputSchema:{deviceId:z.enum(PARITY_DEVICES)}
 },async({deviceId}={})=>{
  if(!PARITY_DEVICES.includes(deviceId))return deny('PARITY_DEVICE_DENIED');
  if(!(await authorized(deviceId,'ping')))return deny('PARITY_HEALTH_FORBIDDEN');
  try{return text(await monitor.check(deviceId,{force:true}));}
  catch{return deny('PARITY_HEALTH_ERROR');}
 });
 return Object.freeze(['dc_list_devices_live','dc_ping']);
}
