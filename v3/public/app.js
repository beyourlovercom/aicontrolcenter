const $=id=>document.getElementById(id);

async function boot(){
  try{
    const response=await fetch('/api/project',{cache:'no-store'});
    const body=await response.json();
    if(!response.ok||!body.available)throw new Error(body.errorCode||'PROJECT_CONTEXT_UNAVAILABLE');
    const {project,repository}=body.context;
    $('project').textContent=`${project.name} (${project.id})`;
    $('repository').textContent=repository.identity;
    $('branch').textContent=repository.branch;
    $('head').textContent=repository.head;
    $('dirty').textContent=repository.dirty?'DIRTY':'CLEAN';
    $('facts').hidden=false;
    $('banner').textContent='唯一 ProjectContext 已加载';
    $('banner').dataset.state='ok';
  }catch(error){
    $('banner').textContent=`PROJECT CONTEXT UNAVAILABLE · ${error.message}`;
    $('banner').dataset.state='error';
  }
}

boot();
