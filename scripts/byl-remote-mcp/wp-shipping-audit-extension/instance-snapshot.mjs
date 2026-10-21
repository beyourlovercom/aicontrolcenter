/**
 * Self-contained isolated-world Chrome scripting function.
 * ONLY fixed Woo instance form IDs, no generic DOM or form serialization.
 * No requests, clicks, modal openings, cookies, storage, form submits or HTML.
 */
export function readWooShippingInstanceDocument(expectedUrl,instanceId,kind){
  const empty={schema:'wp_shipping_instance_dom.v1',pageUrl:'',
    instanceId,kind,uiVerified:false};
  if(typeof expectedUrl!=='string'||!Number.isSafeInteger(instanceId)||
    instanceId<=0||!['free_shipping','flat_rate'].includes(kind))return empty;
  let current;
  try{
    current=new URL(globalThis.location.href);
    if(current.href!==expectedUrl||current.protocol!=='https:'||
      !['dev.beyourlover.com','www.beyourlover.com'].includes(current.hostname)||
      current.pathname!=='/wp-admin/admin.php'||
      current.searchParams.get('page')!=='wc-settings'||
      current.searchParams.get('tab')!=='shipping'||
      current.searchParams.get('instance_id')!==String(instanceId)||
      current.searchParams.size!==3)return empty;
  }catch{return empty;}
  const document=globalThis.document;
  if(!document?.getElementById)return empty;
  const inputId=(key)=>'woocommerce_'+kind+'_'+key;
  const get=(key)=>{
    try{
      const element=document.getElementById(inputId(key));
      if(!element||element.id!==inputId(key))return null;
      const name=String(element.name??'');
      if(name!==inputId(key))return null;
      return element;
    }catch{return null;}
  };
  const raw=(element)=>{
    if(!element)return null;
    const tag=String(element.tagName||'').toUpperCase();
    const type=String(element.type||'').toLowerCase();
    if(tag==='INPUT'&&!['text','number','hidden'].includes(type))return null;
    if(tag!=='INPUT'&&tag!=='SELECT')return null;
    const value=element.value;
    return typeof value==='string'&&value.length<100?value:null;
  };
  const money=(element)=>{
    const value=raw(element);
    if(value===null)return null;
    const trimmed=value.trim();
    return trimmed===''||/^\d{1,8}(?:\.\d{1,2})?$/.test(trimmed)?trimmed:null;
  };
  if(kind==='free_shipping'){
    const requiresElement=get('requires');
    const minimumElement=get('min_amount');
    const discountElement=get('ignore_discounts');
    // Without the method-specific canonical control, we cannot attest
    // which Woo instance form (if any) was actually rendered.
    if(!requiresElement)return empty;
    const requires=raw(requiresElement);
    const discount=(discountElement&&String(discountElement.type||'').toLowerCase()==='checkbox')
      ?discountElement.checked===true:null;
    return {schema:'wp_shipping_instance_dom.v1',pageUrl:current.href,
      instanceId,kind,uiVerified:true,
      requires:requires!==null&&['','coupon','min_amount','either','both'].includes(requires)?
        requires:null,
      minimum:money(minimumElement),
      ignoreDiscounts:discount};
  }
  const costElement=get('cost');
  if(!costElement)return empty;
  const calculationType=raw(get('type'));
  const classCosts=[];
  try{
    const candidates=[...document.querySelectorAll('input[id^="woocommerce_flat_rate_class_cost_"]')];
    for(const el of candidates.slice(0,41)){
      const id=String(el.id||'');
      const match=/^woocommerce_flat_rate_class_cost_(\d{1,8})$/.exec(id);
      if(!match||String(el.name||'')!==id||Number(match[1])<=0)continue;
      classCosts.push({classId:Number(match[1]),cost:money(el)});
    }
  }catch{}
  return {schema:'wp_shipping_instance_dom.v1',pageUrl:current.href,
    instanceId,kind,uiVerified:true,
    cost:money(costElement),
    noClassCost:money(get('no_class_cost')),
    calculationType:['class','order'].includes(calculationType)?calculationType:null,
    classCosts};
}
