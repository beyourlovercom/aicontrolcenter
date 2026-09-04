const $=id=>document.getElementById(id);

async function readJson(path){
  const response=await fetch(path,{cache:'no-store'});
  const body=await response.json();
  if(!response.ok||!body.available){
    const error=new Error(body.errorCode||'NOT_AVAILABLE');
    error.status=body.status||'NOT_AVAILABLE';
    throw error;
  }
  return body;
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
async function boot(){
  try{
    const projectBody=await readJson('/api/project');
    renderProject(projectBody.context);
  }catch(error){
    $('banner').textContent=`PROJECT CONTEXT UNAVAILABLE · ${error.message}`;
    $('banner').dataset.state='error';
    return;
  }

  try{
    const roadmapBody=await readJson('/api/roadmap');
    renderRoadmap(roadmapBody.roadmap);
  }catch(error){
    $('roadmap').hidden=false;
    $('roadmap-status').textContent=`ROADMAP ${error.status||'NOT_AVAILABLE'} · ${error.message}`;
    $('roadmap-status').dataset.state='error';
  }
}

boot();
