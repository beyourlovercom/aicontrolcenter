/**
 * A3/A4: Pure, fail-closed Woo Shipping audit scope.
 * No URLs, scripts or permissions are accepted from a WordPress page.
 * This does NOT register a remote MCP tool or authorize production deployment.
 */
const HOSTS=Object.freeze({DEV:'dev.beyourlover.com',WWW:'www.beyourlover.com'});
const METHOD_IDS=new Set(['flat_rate','free_shipping','local_pickup']);
const WARNING_CODES=new Set([
  'NO_ZONE_ROWS','NO_METHOD_ROWS','PARTIAL_ZONE_FIELDS','PARTIAL_METHOD_FIELDS',
  'UNKNOWN_ADMIN_MARKUP','MISSING_COST','MISSING_MINIMUM','MISSING_REGIONS',
  'MISSING_PRIORITY','NO_VISIBLE_SHIPPING_SETTINGS'
]);
export const AUDIT_SCHEMA='wp_shipping_browser_readonly.v1';
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const validId=(x,max=99999)=>Number.isSafeInteger(x)&&x>=0&&x<=max;
const safeText=(input,max=120)=>{
  if(typeof input!=='string'||input.length>max*3||/[\u0000-\u001F]/.test(input))return null;
  const s=input.replace(/\s+/g,' ').trim();
  return s.length>0&&s.length<=max&&!/[<>\u0000-\u001F]/.test(s)?s:null;
};
const safeMoney=(s)=>{
  if(s===null)return null;
  // Do not serialize arbitrary visible text as a rate; complex Woo formulas
  // remain UNKNOWN until an explicit instance configuration audit.
  return typeof s==='string'&&/^\d{1,8}(?:\.\d{1,2})?$/.test(s)?s:null;
};
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const error=code=>({ok:false,errorCode:code});

export function fixedShippingRequest(input) {
  if(!isObject(input)||Object.keys(input).some(k=>!['environment','operation','zoneId'].includes(k)))
    return error('REQUEST_DENIED');
  if(!own(HOSTS,input.environment))return error('ENVIRONMENT_DENIED');
  if(!['zones','methods'].includes(input.operation))return error('OPERATION_DENIED');
  if(input.operation==='zones'&&own(input,'zoneId'))return error('ZONE_ID_DENIED');
  if(input.operation==='methods'&&!validId(input.zoneId))return error('ZONE_ID_DENIED');
  const host=HOSTS[input.environment];
  const u=new URL('https://'+host+'/wp-admin/admin.php');
  u.searchParams.set('page','wc-settings');
  u.searchParams.set('tab','shipping');
  if(input.operation==='methods')u.searchParams.set('zone_id',String(input.zoneId));
  return Object.freeze({ok:true,environment:input.environment,host,
    origin:'https://'+host+'/',operation:input.operation,
    zoneId:input.operation==='methods'?input.zoneId:null,url:u.href});
}
export function exactAuditPage(href,expected) {
  if(typeof href!=='string'||!expected?.ok)return false;
  try {
    const u=new URL(href);
    return u.href===expected.url&&u.username===''&&u.password===''&&
      u.protocol==='https:'&&u.hostname===expected.host&&u.hash==='';
  }catch{return false;}
}
export function sanitizeBrowserSnapshot(raw,request){
  if(!request?.ok)return error('REQUEST_DENIED');
  if(!isObject(raw)||raw.schema!=='wp_shipping_dom.v1'||
    raw.operation!==request.operation||!exactAuditPage(raw.pageUrl,request)||
    !Array.isArray(raw.rows)||raw.rows.length>100||
    !Array.isArray(raw.warnings)||raw.warnings.length>30)
    return error('UNTRUSTED_SNAPSHOT');
  const warnings=raw.warnings.filter(code=>typeof code==='string'&&WARNING_CODES.has(code));
  if(warnings.length!==raw.warnings.length)return error('UNTRUSTED_WARNINGS');
  const rows=[],seen=new Set();
  let partial=raw.partial===true;
  for(const row of raw.rows){
    if(!isObject(row))return error('UNTRUSTED_ROW');
    if(request.operation==='zones'){
      if(!validId(row.zoneId)&&row.zoneId!==null)return error('ZONE_ID_INVALID');
      const name=safeText(row.name,100);
      const regionDisplay=row.regionDisplay===null?null:safeText(row.regionDisplay,200);
      const priority=row.priority===null?null:(validId(row.priority)?row.priority:false);
      if(priority===false||(!name&&row.name!==null)||(row.regionDisplay!==null&&!regionDisplay))
        return error('ZONE_FIELD_DENIED');
      const zoneId=row.zoneId;
      if(zoneId!==null){if(seen.has(zoneId))return error('ZONE_DUPLICATE');seen.add(zoneId);}
      if(zoneId===null||name===null||priority===null||regionDisplay===null)partial=true;
      rows.push({zoneId,name,regionDisplay,priority});
    }else{
      const instanceId=row.instanceId===null?null:
        (validId(row.instanceId,99999999)?row.instanceId:false);
      if(instanceId===false)return error('METHOD_ID_INVALID');
      if(instanceId!==null){if(seen.has(instanceId))return error('METHOD_DUPLICATE');seen.add(instanceId);}
      const methodId=row.methodId===null?null:row.methodId;
      if(methodId!==null&&!METHOD_IDS.has(methodId))return error('METHOD_DENIED');
      const label=row.label===null?null:safeText(row.label,100);
      const cost=safeMoney(row.cost);
      const minimum=row.minimum===null?null:
        (typeof row.minimum==='string'&&/^\d{1,8}(?:\.\d{1,2})?$/.test(row.minimum)?row.minimum:false);
      const enabled=row.enabled===null?null:row.enabled;
      if((row.label!==null&&!label)||(row.cost!==null&&cost===null)||
        minimum===false||(enabled!==null&&typeof enabled!=='boolean'))
        return error('METHOD_FIELD_DENIED');
      if(instanceId===null||methodId===null||cost===null||enabled===null)partial=true;
      rows.push({instanceId,methodId,label,cost,minimum,enabled});
    }
  }
  if(!rows.length)partial=true;
  return {ok:true,schema:AUDIT_SCHEMA,environment:request.environment,
    site:request.host,source:'consented-chrome-tab-dom',browserUrlVerified:true,
    operation:request.operation,zoneId:request.zoneId,partial,warnings,rows};
}
export function safeExportName(request,date){
  if(!request?.ok||!(date instanceof Date)||!Number.isFinite(date.getTime()))return null;
  const stamp=date.toISOString().replace(/[:.]/g,'-');
  return 'BYL-shipping-readonly-'+request.environment+'-'+request.operation+
    (request.zoneId!==null?'-zone'+request.zoneId:'')+'-'+stamp+'.json';
}
