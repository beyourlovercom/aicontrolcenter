export const DEVICE_REGISTRY=Object.freeze({
  'us-macmini':Object.freeze({id:'us-macmini',state:'READY',upstream:'http://100.94.52.109:8787'}),
  'china-mac':Object.freeze({id:'china-mac',state:'READY',upstream:'http://100.102.15.40:8791'}),
  'windows':Object.freeze({id:'windows',state:'READY',upstream:'http://100.87.29.56:8791'})
});

export function listDevices(){
  return Object.values(DEVICE_REGISTRY).map(({id,state})=>({id,state}));
}

export function resolveDevice(deviceId){
  const id=typeof deviceId==='string'?deviceId.trim():'';
  if(!id)return {ok:false,status:400,errorCode:'GATEWAY_DEVICE_REQUIRED'};
  const device=DEVICE_REGISTRY[id];
  if(!device)return {ok:false,status:404,errorCode:'GATEWAY_DEVICE_UNKNOWN'};
  if(!device.upstream)return {ok:false,status:409,errorCode:'GATEWAY_DEVICE_NOT_READY',device:{id:device.id,state:device.state}};
  return {ok:true,device};
}
