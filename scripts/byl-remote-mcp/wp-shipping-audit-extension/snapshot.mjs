/**
 * Serialized into the Chrome ISOLATED world by scripting.executeScript({func}).
 * All helpers must remain within this function (no imported/browser-privileged globals).
 * Only reads an exact WooCommerce Shipping administration document. Never clicks,
 * submits, fetches, evaluates page scripts, touches cookies/storage, or reads orders.
 */
export function readWooShippingDocument(expectedUrl,operation){
  const blank={schema:'wp_shipping_dom.v1',pageUrl:'',
    operation,rows:[],partial:true,warnings:['UNKNOWN_ADMIN_MARKUP']};
  if(typeof expectedUrl!=='string'||!['zones','methods'].includes(operation))return blank;
  let current;
  try{
    current=new URL(location.href);
    if(current.href!==expectedUrl||current.protocol!=='https:'||
      !['dev.beyourlover.com','www.beyourlover.com'].includes(current.hostname)||
      current.pathname!=='/wp-admin/admin.php'||
      current.searchParams.get('page')!=='wc-settings'||
      current.searchParams.get('tab')!=='shipping')return blank;
  }catch{return blank;}
  const doc=globalThis.document;
  if(!doc?.querySelectorAll)return blank;
  const text=(element,max=180)=>{
    if(!element)return null;
    const value=String(element.textContent??'').replace(/\s+/g,' ').trim();
    return value.length>0&&value.length<=max&&!/[<>\u0000-\u001F]/.test(value)?value:null;
  };
  const int=(s)=>{
    if(s===null||s===undefined||s===''||!/^\d{1,8}$/.test(String(s)))return null;
    const value=Number(s);return Number.isSafeInteger(value)?value:null;
  };
  const attr=(row,name)=>{
    try{return row.getAttribute?.(name)??null;}catch{return null;}
  };
  const one=(row,selectors)=>{
    for(const selector of selectors){try{const el=row.querySelector?.(selector);if(el)return el;}catch{}}
    return null;
  };
  const query=(selector)=>{
    try{return [...doc.querySelectorAll(selector)];}catch{return [];}
  };
  const selectors=operation==='zones'?
    ['table.wc-shipping-zones tbody tr','table.wc_shipping_zones tbody tr']:
    ['table.wc-shipping-zone-methods tbody tr','table.wc_shipping_zone_methods tbody tr'];
  let matched=[];
  for(const selector of selectors){matched=query(selector);if(matched.length)break;}
  if(operation==='zones'){
    // WooCommerce renders Zone 0 "Rest of the world" in tfoot, not tbody.
    const worldwide=query('table.wc-shipping-zones tfoot.wc-shipping-zone-worldwide[data-id="0"]');
    for(const row of worldwide){if(!matched.includes(row))matched.push(row);}
  }
  const rows=[];
  let partial=false;
  for(const row of matched.slice(0,100)){
    if(operation==='zones'){
      let id=int(attr(row,'data-id')??attr(row,'data-zone-id'));
      const anchor=one(row,['td.wc-shipping-zone-name a','td.wc-shipping-zone-name','td.zone_name a','td.zone_name']);
      const name=text(anchor,100);
      const regionDisplay=text(one(row,['td.wc-shipping-zone-region','td.zone_regions','td.wc-shipping-zone-regions']),180);
      const priority=int(attr(row,'data-priority')??attr(row,'data-order'));
      if(id===null||name===null||regionDisplay===null||priority===null)partial=true;
      // Ignore row action URLs, links, nonces and hidden fields entirely.
      if(id!==null||name!==null)rows.push({zoneId:id,name,regionDisplay,priority});
    }else{
      const instanceId=int(attr(row,'data-id')??attr(row,'data-instance-id'));
      let methodId=attr(row,'data-method-id')??attr(row,'data-method');
      if(!['flat_rate','free_shipping','local_pickup'].includes(methodId))methodId=null;
      const label=text(one(row,[
        'td.wc-shipping-zone-method-title a','td.wc-shipping-zone-method-title',
        'td.method_title a','td.method_title'
      ]),100);
      const enabledElement=one(row,['td.wc-shipping-zone-method-enabled input[type="checkbox"]',
        'input[type="checkbox"].wc-shipping-zone-method-enabled']);
      let enabled=enabledElement?enabledElement.checked===true:null;
      if(enabled===null){
        // WooCommerce's actual method row template stores enabled in data-enabled.
        const state=attr(row,'data-enabled');
        if(['yes','true','1'].includes(state))enabled=true;
        if(['no','false','0'].includes(state))enabled=false;
      }
      // The method list normally does not display actual per-instance costs.
      // Read only if a recognized, visible scoped element explicitly has it.
      const costNode=one(row,[
        'td.wc-shipping-zone-method-cost [data-rate-cost]',
        'td.wc-shipping-zone-method-cost input[name="cost"]'
      ]);
      let cost=costNode?(costNode.getAttribute?.('data-rate-cost')??costNode.value):null;
      if(cost!==null){cost=String(cost).trim();if(!/^\d{1,8}(?:\.\d{1,2})?$/.test(cost))cost=null;}
      const minimumNode=one(row,['td.wc-shipping-zone-method-minimum input[name="min_amount"]',
        'td.wc-shipping-zone-method-minimum [data-min-amount]']);
      let minimum=minimumNode?(minimumNode.getAttribute?.('data-min-amount')??minimumNode.value):null;
      if(minimum!==null){minimum=String(minimum).trim();if(!/^\d{1,8}(?:\.\d{1,2})?$/.test(minimum))minimum=null;}
      if(instanceId===null||methodId===null||label===null||enabled===null||cost===null)partial=true;
      if(instanceId!==null||label!==null)rows.push({
        instanceId,methodId,label,cost,minimum,enabled
      });
    }
  }
  if(!rows.length)partial=true;
  const warnings=[];
  if(!rows.length)warnings.push(operation==='zones'?'NO_ZONE_ROWS':'NO_METHOD_ROWS');
  if(partial)warnings.push(operation==='zones'?'PARTIAL_ZONE_FIELDS':'PARTIAL_METHOD_FIELDS');
  if(operation==='methods'&&rows.some(x=>x.cost===null))warnings.push('MISSING_COST');
  if(operation==='zones'&&rows.some(x=>x.regionDisplay===null))warnings.push('MISSING_REGIONS');
  if(operation==='zones'&&rows.some(x=>x.priority===null))warnings.push('MISSING_PRIORITY');
  if(rows.length===0)warnings.push('NO_VISIBLE_SHIPPING_SETTINGS');
  return {schema:'wp_shipping_dom.v1',pageUrl:current.href,
    operation,rows,partial,warnings};
}
