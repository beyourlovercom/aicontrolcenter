const $=id=>document.getElementById(id);
const WP_STATUSES=['OPEN','ACTIVE','BLOCKED','DONE'];
const TASK_STATUSES=['TODO','IN_PROGRESS','BLOCKED','DONE','CANCELLED'];

async function api(path,{method='GET',body}={}){
  const options={method,cache:'no-store',headers:{}};
  if(body!==undefined){
    options.headers['content-type']='application/json';
    options.body=JSON.stringify(body);
  }
  const response=await fetch(path,options);
  const data=await response.json();
  if(!response.ok||data.available===false||data.ok===false){
    const error=new Error(data.errorCode||data.status||'NOT_AVAILABLE');
    error.status=data.status||'NOT_AVAILABLE';
    throw error;
  }
  return data;
}

function renderProject({project,repository}){
  $('project').textContent=`${project.name} (${project.id})`;
  $('repository').textContent=repository.identity;
  $('branch').textContent=repository.branch;
  $('head').textContent=repository.head;
  $('dirty').textContent=repository.dirty?'DIRTY':'CLEAN';
  $('facts').hidden=false;
  $('banner').textContent='唯一 ProjectContext 已加载';
  $('banner').dataset.state='ok';
}
function renderMilestones(items){
  const root=$('milestone-list');
  root.replaceChildren();
  for(const item of items){
    const row=document.createElement('article');
    const title=document.createElement('strong');
    const detail=document.createElement('span');
    title.textContent=item.title;
    detail.textContent=[item.goal,item.estimate].filter(Boolean).join(' · ');
    row.append(title,detail);
    root.append(row);
  }
}

function renderRoadmap(roadmap){
  const {current,authority}=roadmap;
  $('current-milestone').textContent=current.milestone;
  $('current-wp').textContent=current.workPackage;
  $('current-phase').textContent=current.phase;
  $('roadmap-revision').textContent=`Revision ${roadmap.revision}`;
  $('roadmap-authority').textContent=`${authority.repositoryIdentity} · ${authority.repositoryHead} · ${authority.source}`;
  renderMilestones(roadmap.milestones);
  $('roadmap-status').textContent='CANONICAL ROADMAP AVAILABLE';
  $('roadmap-status').dataset.state='ok';
  $('roadmap').hidden=false;
}

function option(value,label=value){
  const node=document.createElement('option');
  node.value=value;node.textContent=label;
  return node;
}
function setWorkMessage(message,state=''){
  $('work-message').textContent=message;
  $('work-message').dataset.state=state;
}

function statusControl(kind,entity,statuses,terminal){
  const wrap=document.createElement('div');
  wrap.className='status-control';
  if(terminal){
    const done=document.createElement('span');
    done.className='terminal';done.textContent='TERMINAL';
    wrap.append(done);return wrap;
  }
  const select=document.createElement('select');
  select.append(option('','选择新状态…'));
  select.firstElementChild.disabled=true;select.firstElementChild.selected=true;
  for(const status of statuses){if(status!==entity.status)select.append(option(status));}
  const button=document.createElement('button');
  button.type='button';button.textContent='更新状态';
  button.addEventListener('click',async()=>{
    if(!select.value)return setWorkMessage('请选择明确的新状态。','error');
    const path=kind==='wp'?`/api/work-packages/${encodeURIComponent(entity.id)}/status`:`/api/tasks/${encodeURIComponent(entity.id)}/status`;
    try{
      await api(path,{method:'PATCH',body:{status:select.value}});
      await loadWork();setWorkMessage(`${kind==='wp'?'WP':'Task'} 状态已持久化。`,'ok');
    }catch(error){setWorkMessage(`更新失败 · ${error.message}`,'error');}
  });
  wrap.append(select,button);return wrap;
}

function entityCard(kind,entity,wpTitle=''){
  const card=document.createElement('article');card.className='entity-card';
  const top=document.createElement('div');top.className='entity-top';
  const title=document.createElement('strong');title.textContent=entity.title;
  const badge=document.createElement('span');badge.className='status-badge';badge.textContent=entity.status;
  top.append(title,badge);card.append(top);
  const meta=document.createElement('div');meta.className='entity-meta';
  meta.textContent=kind==='wp'?entity.id:`WP: ${wpTitle||entity.workPackageId} · ${entity.id}`;
  card.append(meta);
  const terminal=kind==='wp'?entity.status==='DONE':['DONE','CANCELLED'].includes(entity.status);
  card.append(statusControl(kind,entity,kind==='wp'?WP_STATUSES:TASK_STATUSES,terminal));
  return card;
}
function renderWork(store){
  $('work-revision').textContent=`Revision ${store.revision}`;
  $('work-authority').textContent=`${store.project.id} · ${store.project.repositoryIdentity}`;
  const wpSelect=$('task-wp');const previous=wpSelect.value;
  wpSelect.replaceChildren();
  if(store.workPackages.length===0){
    wpSelect.append(option('','请先创建 Work Package'));
    wpSelect.disabled=true;$('task-form').querySelector('button').disabled=true;
  }else{
    wpSelect.disabled=false;$('task-form').querySelector('button').disabled=false;
    wpSelect.append(option('','选择 Work Package…'));wpSelect.firstElementChild.disabled=true;
    for(const wp of store.workPackages)wpSelect.append(option(wp.id,`${wp.title} · ${wp.status}`));
    if([...wpSelect.options].some(item=>item.value===previous))wpSelect.value=previous;
  }

  const wpRoot=$('wp-list');wpRoot.replaceChildren();
  if(store.workPackages.length===0){const empty=document.createElement('p');empty.className='empty';empty.textContent='暂无 Work Package';wpRoot.append(empty);}
  for(const wp of store.workPackages)wpRoot.append(entityCard('wp',wp));

  const byId=new Map(store.workPackages.map(wp=>[wp.id,wp.title]));
  const taskRoot=$('task-list');taskRoot.replaceChildren();
  if(store.tasks.length===0){const empty=document.createElement('p');empty.className='empty';empty.textContent='暂无 Task';taskRoot.append(empty);}
  for(const task of store.tasks)taskRoot.append(entityCard('task',task,byId.get(task.workPackageId)));

  $('work-status').textContent='PROJECT-SCOPED WORK STORE AVAILABLE';
  $('work-status').dataset.state='ok';
  $('work').hidden=false;
}

async function loadWork(){
  const body=await api('/api/work');
  renderWork(body.store);
  return body.store;
}
$('wp-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const title=$('wp-title').value.trim();const status=$('wp-create-status').value;
  try{
    await api('/api/work-packages',{method:'POST',body:{title,status}});
    event.currentTarget.reset();await loadWork();setWorkMessage('Work Package 已创建并持久化。','ok');
  }catch(error){setWorkMessage(`创建 WP 失败 · ${error.message}`,'error');}
});

$('task-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const workPackageId=$('task-wp').value;const title=$('task-title').value.trim();const status=$('task-create-status').value;
  try{
    await api('/api/tasks',{method:'POST',body:{workPackageId,title,status}});
    $('task-title').value='';$('task-create-status').value='TODO';
    await loadWork();setWorkMessage('Task 已创建并绑定到 Work Package。','ok');
  }catch(error){setWorkMessage(`创建 Task 失败 · ${error.message}`,'error');}
});

async function boot(){
  try{
    const projectBody=await api('/api/project');renderProject(projectBody.context);
  }catch(error){
    $('banner').textContent=`PROJECT CONTEXT UNAVAILABLE · ${error.message}`;$('banner').dataset.state='error';return;
  }
  try{const roadmapBody=await api('/api/roadmap');renderRoadmap(roadmapBody.roadmap);}
  catch(error){$('roadmap').hidden=false;$('roadmap-status').textContent=`ROADMAP ${error.status||'NOT_AVAILABLE'} · ${error.message}`;$('roadmap-status').dataset.state='error';}
  try{await loadWork();}
  catch(error){$('work').hidden=false;$('work-status').textContent=`WORK STORE NOT AVAILABLE · ${error.message}`;$('work-status').dataset.state='error';}
}

boot();
