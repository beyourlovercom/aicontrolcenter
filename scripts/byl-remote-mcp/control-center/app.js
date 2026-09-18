const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const fmtTime=v=>v?new Date(v).toLocaleString():'—';
const fmtSeen=v=>v?'刚刚':'离线';
const toast=msg=>{
  const el=$('#toast');el.textContent=msg;el.classList.add('show');
  clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.remove('show'),2200);
};

$$('.nav-item').forEach(btn=>btn.addEventListener('click',()=>{
  $$('.nav-item').forEach(x=>x.classList.remove('active'));btn.classList.add('active');
  $$('.view').forEach(x=>x.classList.remove('active'));
  $('#'+btn.dataset.view+'View').classList.add('active');
}));

function deviceRow(d){
  return '<div class="device-row">'+
    '<div class="device-name"><span class="status-dot '+(d.online?'ok':'')+'"></span><div><strong>'+d.name+'</strong><small>'+d.subtitle+'</small></div></div>'+
    '<div class="metric"><small>状态</small><strong>'+(d.online?'Online':'Offline')+'</strong></div>'+
    '<div class="metric"><small>DC</small><strong>'+d.version+'</strong></div>'+
    '<div class="metric"><small>延迟</small><strong>'+(d.online?d.latencyMs+' ms':'—')+'</strong></div>'+
    '<div class="metric"><small>最后在线</small><strong>'+fmtSeen(d.lastSeen)+'</strong></div>'+
    '<div class="device-actions"><button class="ghost" data-check="'+d.id+'">检查</button><button class="danger" data-restart="'+d.id+'" '+(d.online?'':'disabled')+'>重连</button></div>'+
  '</div>';
}function render(data){
  $('#loginUser').textContent=data.user||'Cloudflare Access';
  const online=data.devices.filter(d=>d.online).length;
  $('#gatewayStatus').textContent=data.gateway.ok?'Healthy':'Offline';
  $('#gatewayLatency').textContent=data.gateway.ok?data.gateway.latencyMs+' ms':'—';
  $('#deviceSummary').textContent=online+' / '+data.devices.length;
  $('#updatedAt').textContent='更新 '+new Date(data.generatedAt).toLocaleTimeString();
  $('#deviceList').innerHTML=data.devices.map(deviceRow).join('');
  const allOk=data.gateway.ok&&online===data.devices.length;
  $('#sideDot').className='dot '+(allOk?'ok':'bad');
  $('#sideText').textContent=allOk?'全部在线':'需要检查';

  const c=data.canary;
  $('#canaryStatus').textContent=c.failed===0&&c.checks>0?'PASS':'CHECK';
  $('#canaryChecks').textContent=c.checks+' 次检查';
  $('#cChecks').textContent=c.checks;
  $('#cPassed').textContent=c.passed;
  $('#cFailed').textContent=c.failed;
  $('#cLatest').textContent=c.last?.ok?'PASS':(c.last?'FAIL':'—');
  $('#canaryTime').textContent=c.first?'开始：'+fmtTime(c.first)+' · 最近：'+fmtTime(c.last?.ts):'尚未开始';
  const start=c.first?new Date(c.first).getTime():Date.now();
  const pct=Math.max(0,Math.min(100,(Date.now()-start)/(7*24*3600*1000)*100));
  $('#canaryBar').style.width=pct+'%';

  const rows=[['Gateway',data.gateway.ok,data.gateway.ok?data.gateway.latencyMs+' ms':'未响应']].concat(
    data.devices.map(d=>[d.name,d.online,d.online?(d.latencyMs+' ms · DC '+d.version+' · '+d.toolCount+' tools'):'未响应'])
  );
  $('#healthRows').innerHTML=rows.map(r=>'<div class="health-row"><span>'+r[0]+'</span><strong class="'+(r[1]?'ok':'bad')+'">'+(r[1]?'Healthy':'Offline')+' · '+r[2]+'</strong></div>').join('');
  bindActions();
}async function load(){
  $('#refreshBtn').disabled=true;
  try{
    const r=await fetch('/control/api/status',{cache:'no-store'});
    if(!r.ok)throw new Error('status '+r.status);
    render(await r.json());
  }catch(e){
    $('#sideDot').className='dot bad';$('#sideText').textContent='状态读取失败';toast('状态读取失败');
  }finally{$('#refreshBtn').disabled=false}
}
async function checkDevice(id,btn){
  btn.disabled=true;
  try{
    const r=await fetch('/control/api/check',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({deviceId:id})});
    if(!r.ok)throw new Error('check '+r.status);
    render(await r.json());toast('检查完成');
  }catch{toast('检查失败')}finally{btn.disabled=false}
}
async function restartDevice(id,btn){
  if(!confirm('确认重连该设备？Agent 会重启一次并自动恢复。'))return;
  btn.disabled=true;btn.textContent='重连中…';
  try{
    const r=await fetch('/control/api/restart',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({deviceId:id})});
    const data=await r.json();
    if(!r.ok||!data.ok)throw new Error(data.error||'restart failed');
    toast('重连成功');await load();
  }catch(e){toast('重连失败：'+e.message)}finally{btn.disabled=false;btn.textContent='重连'}
}function bindActions(){
  $$('[data-check]').forEach(btn=>btn.onclick=()=>checkDevice(btn.dataset.check,btn));
  $$('[data-restart]').forEach(btn=>btn.onclick=()=>restartDevice(btn.dataset.restart,btn));
}
$('#refreshBtn').addEventListener('click',load);
load();
setInterval(load,15000);