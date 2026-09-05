const $=id=>document.getElementById(id);
const WP_STATUSES=['OPEN','ACTIVE','BLOCKED','DONE'];
const TASK_STATUSES=['TODO','IN_PROGRESS','BLOCKED','DONE','CANCELLED'];
const RUN_TERMINAL_STATES=['EXITED','STOPPED','ORPHANED','SPAWN_ERROR'];
let executorReady=false;let executorLease=null;let currentRunId=null;let eventAfter=0;let eventRows=[];let runPoll=null;

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
  renderRunTaskOptions(store,byId);
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

function setExecutorMessage(message,state=''){
  $('executor-message').textContent=message;$('executor-message').dataset.state=state;
}
function renderRunTaskOptions(store,byId){
  const select=$('run-task');const previous=select.value;select.replaceChildren();
  if(store.tasks.length===0){select.append(option('','暂无可执行 Task'));select.disabled=true;}
  else{
    select.disabled=false;select.append(option('','选择明确 Task…'));select.firstElementChild.disabled=true;
    for(const task of store.tasks)select.append(option(task.id,`${byId.get(task.workPackageId)||task.workPackageId} / ${task.title} · ${task.status}`));
    if([...select.options].some(item=>item.value===previous))select.value=previous;
  }
  updateStartAvailability();
}
function updateStartAvailability(){
  const button=$('start-run');if(!button)return;
  button.disabled=!executorReady||Boolean(executorLease)||$('run-task').disabled;
}
function renderExecutorStatus(executor){
  executorReady=Boolean(executor.readiness?.ready);executorLease=executor.activeLease||null;
  const readiness=executor.readiness||{};
  $('executor-readiness').textContent=executorReady?`${readiness.version||'Codex'} · READY`:`NOT READY · ${readiness.errorCode||'UNKNOWN'}`;
  $('executor-status').textContent=executorReady?'CODEX EXECUTOR READY':'CODEX EXECUTOR NOT READY';
  $('executor-status').dataset.state=executorReady?'ok':'error';$('executor').hidden=false;updateStartAvailability();
}
function stopPolling(){if(runPoll){clearInterval(runPoll);runPoll=null;}}
function renderRun(run){
  currentRunId=run.runId;$('run-panel').hidden=false;$('run-id').textContent=run.runId;$('run-state').textContent=run.state;
  $('run-task-id').textContent=run.taskId;$('run-session').textContent=run.codexSessionId||'NOT IDENTIFIED';
  $('stop-run').disabled=RUN_TERMINAL_STATES.includes(run.state);
  if(RUN_TERMINAL_STATES.includes(run.state)){executorLease=null;updateStartAvailability();stopPolling();}
}
function renderEvents(){
  $('run-events').textContent=eventRows.length?eventRows.map(event=>JSON.stringify(event)).join('\n'):'暂无 Run event';
}
function clearResult(message='RESULT NOT READY'){
  $('result-panel').hidden=false;$('result-status').textContent=message;$('result-status').dataset.state='';
  $('result-id').textContent='—';$('result-run-id').textContent=currentRunId||'—';$('result-source').textContent='';
  $('result-content-sha').textContent='—';$('result-raw-sha').textContent='—';$('result-content').textContent='';
}
function renderResult(result){
  $('result-panel').hidden=false;$('result-status').textContent='CANONICAL RESULT AVAILABLE';$('result-status').dataset.state='ok';
  $('result-id').textContent=result.resultId;$('result-run-id').textContent=result.runId;$('result-source').textContent=`Source event #${result.sourceEventSeq}`;
  $('result-content-sha').textContent=result.contentSha256;$('result-raw-sha').textContent=result.sourceRawSha256;$('result-content').textContent=result.content;
}
async function loadResult(run){
  if(run.state!=='EXITED'){clearResult(`RESULT NOT READY · transport state ${run.state}`);return null;}
  try{const body=await api(`/api/runs/${encodeURIComponent(run.runId)}/result`);renderResult(body.result);return body.result;}
  catch(error){clearResult(`RESULT NOT AVAILABLE · ${error.message}`);$('result-status').dataset.state='error';return null;}
}
async function loadRun(runId,{reset=false}={}){
  if(reset||currentRunId!==runId){currentRunId=runId;eventAfter=0;eventRows=[];}
  const runBody=await api(`/api/runs/${encodeURIComponent(runId)}`);renderRun(runBody.run);
  const eventBody=await api(`/api/runs/${encodeURIComponent(runId)}/events?after=${eventAfter}`);
  if(eventBody.events.length){eventRows.push(...eventBody.events);eventAfter=eventRows.at(-1).seq;}renderEvents();
  await loadResult(runBody.run);return runBody.run;
}
function startPolling(runId){
  stopPolling();runPoll=setInterval(async()=>{
    try{const run=await loadRun(runId);if(RUN_TERMINAL_STATES.includes(run.state))stopPolling();}
    catch(error){stopPolling();setExecutorMessage(`Run 刷新失败 · ${error.message}`,'error');}
  },1000);
}
async function loadExecutor(){
  const body=await api('/api/executor');renderExecutorStatus(body.executor);
  if(body.executor.latestRun){
    const run=await loadRun(body.executor.latestRun.runId,{reset:true});
    if(body.executor.activeLease&&!RUN_TERMINAL_STATES.includes(run.state))startPolling(run.runId);
  }else{$('run-panel').hidden=true;$('result-panel').hidden=true;currentRunId=null;eventAfter=0;eventRows=[];}
}
$('run-form').addEventListener('submit',async event=>{
  event.preventDefault();const taskId=$('run-task').value;const instruction=$('run-instruction').value;
  try{
    const body=await api('/api/runs',{method:'POST',body:{taskId,instruction}});
    executorLease={runId:body.run.runId};updateStartAvailability();setExecutorMessage(`Run 已创建 · ${body.run.runId}`,'ok');
    await loadRun(body.run.runId,{reset:true});startPolling(body.run.runId);
  }catch(error){setExecutorMessage(`Start 失败 · ${error.message}`,'error');}
});
$('stop-run').addEventListener('click',async()=>{
  if(!currentRunId)return;const exact=currentRunId;
  try{
    await api(`/api/runs/${encodeURIComponent(exact)}/stop`,{method:'POST'});
    setExecutorMessage(`Stop 已发送给 exact Run · ${exact}`,'ok');await loadRun(exact);startPolling(exact);
  }catch(error){setExecutorMessage(`Stop 失败 · ${error.message}`,'error');}
});

function setPrMessage(message,state=''){
  $('pr-message').textContent=message;$('pr-message').dataset.state=state;
}
function renderCheck(check){
  const card=document.createElement('article');card.className='entity-card';
  const top=document.createElement('div');top.className='entity-top';
  const name=document.createElement('strong');name.textContent=check.name;
  const badge=document.createElement('span');badge.className='status-badge';badge.textContent=`${check.status}${check.conclusion?` / ${check.conclusion}`:''}`;
  top.append(name,badge);card.append(top);
  const meta=document.createElement('div');meta.className='entity-meta';meta.textContent=`HEAD ${check.headSha} · check ${check.id}`;card.append(meta);
  return card;
}
function renderPullRequest(pr){
  const card=document.createElement('article');card.className='entity-card';
  const top=document.createElement('div');top.className='entity-top';
  const title=document.createElement('strong');title.textContent=`#${pr.number} · ${pr.title}`;
  const badge=document.createElement('span');badge.className='status-badge';badge.textContent=`${pr.state}${pr.isDraft?' · DRAFT':''}`;
  top.append(title,badge);card.append(top);
  const meta=document.createElement('div');meta.className='entity-meta';meta.textContent=`${pr.headRefName}@${pr.headRefOid} → ${pr.baseRefName}`;card.append(meta);
  if(pr.url){const link=document.createElement('a');link.href=pr.url;link.target='_blank';link.rel='noreferrer';link.textContent='Open on GitHub';link.className='pr-link';card.append(link);}
  return card;
}
function renderPrDelivery(delivery){
  $('pr-repository').textContent=delivery.repository.identity;
  $('pr-default-branch').textContent=delivery.repository.defaultBranch;
  $('pr-local-head').textContent=delivery.local.head;
  $('pr-remote-head').textContent=delivery.origin.remoteHeadSha||'NOT FOUND';
  const ready=Boolean(delivery.draftPrerequisites?.ready);
  $('pr-readiness').textContent=ready?'DRAFT PREREQUISITES READY':'DRAFT PR BLOCKED';
  $('pr-status').textContent=delivery.origin.exactHeadMatch?'GITHUB EXACT-HEAD FACTS AVAILABLE':'GITHUB HEAD MISMATCH';
  $('pr-status').dataset.state=delivery.origin.exactHeadMatch?'ok':'error';
  const base=$('pr-base');base.replaceChildren();base.append(option(delivery.repository.defaultBranch));base.value=delivery.repository.defaultBranch;
  const existing=delivery.pullRequests.find(pr=>pr.headRefName===delivery.local.branch&&pr.baseRefName===delivery.repository.defaultBranch);
  $('create-draft-pr').disabled=!ready||Boolean(existing);
  const checks=$('pr-checks');checks.replaceChildren();
  if(delivery.checks.length===0){const empty=document.createElement('p');empty.className='empty';empty.textContent='暂无 exact-head check';checks.append(empty);}
  for(const check of delivery.checks)checks.append(renderCheck(check));
  const prs=$('pr-list');prs.replaceChildren();
  if(delivery.pullRequests.length===0){const empty=document.createElement('p');empty.className='empty';empty.textContent='当前 head 暂无 open PR';prs.append(empty);}
  for(const pr of delivery.pullRequests)prs.append(renderPullRequest(pr));
  if(existing)setPrMessage(`Draft PR creation unavailable · open PR #${existing.number} already exists for this head/base.`,'');
  else if(!ready)setPrMessage(`Draft PR blocked · ${(delivery.draftPrerequisites?.blockers||[]).join(', ')||'UNKNOWN'}`,'error');
  $('pr-delivery').hidden=false;
}
async function loadPrDelivery(){
  const body=await api('/api/pr-delivery');renderPrDelivery(body.delivery);return body.delivery;
}
$('draft-pr-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const title=$('pr-title').value.trim();const body=$('pr-body').value;const baseRef=$('pr-base').value;
  try{
    const response=await api('/api/prs/draft',{method:'POST',body:{title,body,baseRef}});
    setPrMessage(`Draft PR #${response.pullRequest.number} 已由 GitHub 创建。`,'ok');
    await loadPrDelivery();
  }catch(error){
    if(error.message==='PR_ALREADY_EXISTS'){
      await loadPrDelivery();
      setPrMessage('Draft PR 已存在；已刷新 GitHub facts。','ok');
    }else setPrMessage(`Create Draft PR 失败 · ${error.message}`,'error');
  }
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
  try{await loadExecutor();}
  catch(error){$('executor').hidden=false;$('executor-status').textContent=`EXECUTOR NOT AVAILABLE · ${error.message}`;$('executor-status').dataset.state='error';}
  try{await loadPrDelivery();}
  catch(error){$('pr-delivery').hidden=false;$('pr-status').textContent=`PR DELIVERY NOT AVAILABLE · ${error.message}`;$('pr-status').dataset.state='error';$('create-draft-pr').disabled=true;}
}

boot();
