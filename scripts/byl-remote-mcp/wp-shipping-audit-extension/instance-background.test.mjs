import test from 'node:test';
import assert from 'node:assert/strict';
import {fixedInstanceBatchRequest} from './instance-guard.mjs';

test('synthetic browser: Dev-first, nine guarded GETs, cleanup and local-only export',async()=>{
  const original={chrome:globalThis.chrome,document:globalThis.document,location:globalThis.location};
  const events=[],tabs=new Map(),activeRules=new Map(),sessions={},
    local={},downloads=[],updatedListeners=new Set(),removedListeners=new Set();
  let onMessage,tabCount=0;
  const fakeField=(kind,key,value,type='text')=>{
    const id='woocommerce_'+kind+'_'+key;
    return {id,name:id,tagName:type==='select-one'?'SELECT':'INPUT',
      type,value:String(value),checked:value===true};
  };
  globalThis.chrome={
    runtime:{
      id:'synthetic-a5-extension',
      onStartup:{addListener(){}},
      onMessage:{addListener(fn){onMessage=fn;}}
    },
    permissions:{async contains(){return true;}},
    storage:{
      session:{
        async get(k){return {[k]:sessions[k]};},
        async set(v){Object.assign(sessions,v);},
        async remove(k){delete sessions[k];}
      },
      local:{
        async get(k){return {[k]:local[k]};},
        async set(v){Object.assign(local,v);}
      }
    },
    tabs:{
      onUpdated:{
        addListener(fn){updatedListeners.add(fn);},
        removeListener(fn){updatedListeners.delete(fn);}
      },
      onRemoved:{
        addListener(fn){removedListeners.add(fn);},
        removeListener(fn){removedListeners.delete(fn);}
      },
      async create({url,active}){
        assert.equal(url,'about:blank');assert.equal(active,false);
        const id=++tabCount;
        const tab={id,url,status:'complete'};
        tabs.set(id,tab);events.push(['create',id]);
        return {...tab};
      },
      async update(id,{url,active}){
        assert.equal(active,false);
        assert.ok(activeRules.size>0,'navigation must be protected');
        const tab=tabs.get(id);
        assert.ok(tab);
        assert.equal(activeRules.get(id)!==undefined,true);
        tab.url=url;tab.status='complete';events.push(['navigate',id,url]);
        return {...tab};
      },
      async get(id){
        const tab=tabs.get(id);
        if(!tab)throw Error('TAB_UNAVAILABLE');
        return {...tab};
      },
      async remove(id){
        if(!tabs.has(id))throw Error('TAB_UNAVAILABLE');
        tabs.delete(id);events.push(['close',id]);
        for(const listener of removedListeners)listener(id);
      }
    },
    declarativeNetRequest:{
      async updateSessionRules({addRules,removeRuleIds}){
        if(addRules){
          for(const rule of addRules){
            assert.deepEqual(rule.condition.requestMethods,
              ['post','put','patch','delete','connect','other']);
            assert.ok(rule.condition.resourceTypes.includes('main_frame'));
            const id=rule.condition.tabIds[0];
            activeRules.set(id,rule.id);events.push(['arm',id]);
          }
        }
        if(removeRuleIds){
          for(const ruleId of removeRuleIds){
            const entry=[...activeRules].find(([,id])=>id===ruleId);
            assert.ok(entry,'must remove a previously armed rule');
            activeRules.delete(entry[0]);events.push(['disarm',entry[0]]);
          }
        }
      }
    },
    scripting:{
      async executeScript({target,world,func,args}){
        assert.equal(world,'ISOLATED');
        const tab=tabs.get(target.tabId);
        assert.ok(tab);assert.equal(tab.url,args[0]);
        const [url,instanceId,kind]=args;
        events.push(['read',target.tabId,instanceId]);
        globalThis.location={href:url};
        const map={};
        if(kind==='free_shipping'){
          for(const element of [
            fakeField(kind,'requires','min_amount','select-one'),
            fakeField(kind,'min_amount','69.00'),
            fakeField(kind,'ignore_discounts',false,'checkbox')])map[element.id]=element;
        }else{
          for(const element of [
            fakeField(kind,'cost','0'),fakeField(kind,'no_class_cost',''),
            fakeField(kind,'type','class','select-one')])map[element.id]=element;
        }
        globalThis.document={
          getElementById(id){return map[id]??null;},
          querySelectorAll(){return [];}
        };
        return [{result:func(...args)}];
      }
    },
    downloads:{
      async download({url,filename,saveAs,conflictAction}){
        assert.equal(saveAs,false);assert.equal(conflictAction,'uniquify');
        assert.ok(url.startsWith('data:application/json;charset=utf-8,'));
        const json=JSON.parse(decodeURIComponent(url.split(',')[1]));
        assert.equal(json.schema,'wp_shipping_instance_details_readonly.v1');
        downloads.push({filename,json});
        events.push(['download',downloads.length]);
        return downloads.length;
      },
      async search({id}){
        return [{state:'complete',filename:'/local/test/Downloads/'+downloads[id-1].filename}];
      }
    }
  };
  try{
    await import('./background.mjs?synthetic-a5-test=1');
    assert.equal(typeof onMessage,'function');
    const send=(input)=>new Promise((resolve,reject)=>{
      const callback=(output)=>resolve(output);
      try{
        const hold=onMessage({type:'BYL_WP_SHIPPING_AUDIT',request:input},
          {id:'synthetic-a5-extension'},callback);
        if(!hold&&input.operation==='instanceBatch')reject(Error('not async'));
      }catch(err){reject(err);}
    });
    const noDev=await send({environment:'WWW',operation:'instanceBatch'});
    assert.equal(noDev.ok,false);assert.equal(noDev.errorCode,'DEV_A5_REQUIRED');
    assert.equal(tabCount,0);
    const dev=await send({environment:'DEV',operation:'instanceBatch'});
    assert.equal(dev.ok,true);assert.equal(dev.count,9);
    assert.equal(dev.partial,false,'all required fixture fields are explicitly present');
    assert.equal(local.bylWpShippingA5DevBatchCompletedV1,true);
    assert.equal(tabCount,9);assert.equal(tabs.size,0);assert.equal(activeRules.size,0);
    assert.equal(sessions.bylWpShippingActiveAuditV1,undefined);
    assert.equal(downloads[0].json.environment,'DEV');
    assert.deepEqual(downloads[0].json.details.map(x=>x.instanceId),
      fixedInstanceBatchRequest({environment:'DEV',operation:'instanceBatch'})
        .targets.map(x=>x.instanceId));
    const www=await send({environment:'WWW',operation:'instanceBatch'});
    assert.equal(www.ok,true);assert.equal(www.count,9);
    assert.equal(downloads[1].json.environment,'WWW');
    assert.equal(tabCount,18);assert.equal(activeRules.size,0);
    assert.equal(tabs.size,0);
    for(let id=1;id<=18;id++){
      const seq=events.filter(x=>x[1]===id&&x[0]!=='download').map(x=>x[0]);
      assert.deepEqual(seq,['create','arm','navigate','read','close','disarm']);
    }
    assert.ok(JSON.stringify(downloads).includes('"requires": "min_amount"'));
    assert.ok(!JSON.stringify(downloads).includes('wordpress_logged_in'));
  }finally{
    globalThis.chrome=original.chrome;
    globalThis.document=original.document;
    globalThis.location=original.location;
  }
});
