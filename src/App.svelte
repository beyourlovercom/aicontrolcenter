<script lang="ts">
  import {onDestroy,onMount,tick} from 'svelte';
  import RoadmapTree from './components/RoadmapTree.svelte';
  import StatusTabs from './components/StatusTabs.svelte';
  import WorkflowTimeline from './components/WorkflowTimeline.svelte';
  import EntityHeader from './components/entity/EntityHeader.svelte';
  import EntityEvidencePanel from './components/entity/EntityEvidencePanel.svelte';
  import MilestoneView from './components/entity/MilestoneView.svelte';
  import OwnerActionZone from './components/entity/OwnerActionZone.svelte';
  import {createProjectSnapshot,type RawProjectSources} from './lib/model/projectModel';
  import {resolveEntityContext} from './lib/context/entityContext';
  import type {ActionEligibility,FormalWorkPackage,SelectedEntityRef,WorkPackageEntityContext} from './lib/model/entityTypes';

  type Drawer='roadmap'|'status'|null;
  type Feedback={state:'IDLE'|'RUNNING'|'SUCCESS'|'BLOCKED'|'ERROR';title:string;message:string;code?:string;next?:string};
  let drawer:Drawer=null,leftWidth=320,rightWidth=320,busy=false,activeTab='概览',codexInfo:any=null,selectionRequest=0,runtimeTimer:number|undefined;
  let selectedEntity:SelectedEntityRef={type:'work_package',id:'AICC-V2-PR-RUNNER-001'};
  let raw:RawProjectSources={formalWorkPackages:{}};
  let feedback:Feedback={state:'IDLE',title:'等待 Owner 操作',message:'请选择上方操作。最近一次操作结果会保留在这里。'};
  $: snapshot=createProjectSnapshot(raw);
  $: context=resolveEntityContext(snapshot,selectedEntity);
  $: roadmapNodes=snapshot.roadmap.value??[];
  $: tabStatuses=context.type==='work_package'?{概览:context.status,流程:context.status,工作包:context.formalization==='FORMAL_READY'?'PASS':'NOT_STARTED',运行:context.runtime&&['STARTING','RUNNING','STOPPING'].includes(context.runtime.phase)?'IN_PROGRESS':context.runtime?'PASS':'NOT_STARTED',验证:context.lifecycle.stages.find(stage=>stage.id==='VALIDATION')?.status??'N_A',UAT:context.lifecycle.stages.find(stage=>stage.id==='HUMAN_UAT')?.status??'N_A',证据:snapshot.repository.availability==='AVAILABLE'?'PASS':'BLOCKED'}:{};

  function setFeedback(value:Feedback){feedback=value}
  async function request(url:string,options?:RequestInit){const response=await fetch(url,options);const data=await response.json();if(!response.ok){const value=typeof data.error==='object'?data.error:{code:data.error,message:data.error};throw new Error(`${value.code??'ACTION_ERROR'}: ${value.message??'操作失败'}`)}return data}
  async function readFormalWorkPackage(id:string,token:number){if(raw.formalWorkPackages?.[id])return;try{const response=await fetch(`/api/work-packages/${encodeURIComponent(id)}`);if(response.status===404)return; if(!response.ok)throw new Error('FORMAL_WP_SOURCE_UNAVAILABLE');const workPackage=await response.json() as FormalWorkPackage;if(token===selectionRequest)raw={...raw,formalWorkPackages:{...raw.formalWorkPackages,[id]:workPackage}}}catch{if(token===selectionRequest)raw={...raw,sourceErrors:{...raw.sourceErrors,formalWorkPackages:'FORMAL_WP_SOURCE_UNAVAILABLE'}}}}
  async function loadSnapshot(showFeedback=true){
    if(showFeedback)setFeedback({state:'RUNNING',title:'正在刷新状态…',message:'正在重建项目快照与当前实体上下文。',code:'REFRESHING'});
    const selectedAtStart=selectedEntity;
    const [roadmapResult,repositoryResult,authorizationResult,runtimeResult]=await Promise.allSettled([request('/api/roadmap'),request('/api/repository'),request(`/api/authorization?workPackageId=${encodeURIComponent(selectedAtStart.type==='work_package'?selectedAtStart.id:'')}`),request('/api/codex/runtime')]);
    const sourceErrors:RawProjectSources['sourceErrors']={};
    const next:RawProjectSources={...raw,sourceErrors};
    if(roadmapResult.status==='fulfilled')next.roadmap=roadmapResult.value;else sourceErrors.roadmap='ROADMAP_UNAVAILABLE';
    if(repositoryResult.status==='fulfilled')next.repository=repositoryResult.value;else sourceErrors.repository='REPOSITORY_UNAVAILABLE';
    if(authorizationResult.status==='fulfilled')next.authorization=authorizationResult.value.record??null;else sourceErrors.authorizations='AUTHORIZATION_UNAVAILABLE';
    if(runtimeResult.status==='fulfilled'){next.runtime=runtimeResult.value.runtime??null;codexInfo=runtimeResult.value.info}else sourceErrors.runtime='RUNTIME_UNAVAILABLE';
    raw=next;
    if(selectedAtStart.type==='work_package')await readFormalWorkPackage(selectedAtStart.id,selectionRequest);
    if(showFeedback)setFeedback({state:'SUCCESS',title:'状态已刷新',message:'项目快照与当前实体上下文已重新构建。',code:'REFRESH_SUCCESS'});
  }
  function startRuntimePolling(){if(runtimeTimer)clearInterval(runtimeTimer);runtimeTimer=window.setInterval(async()=>{try{const data=await request('/api/codex/runtime');raw={...raw,runtime:data.runtime??null};codexInfo=data.info;if(!data.runtime||!['STARTING','RUNNING','STOPPING'].includes(data.runtime.phase)){if(runtimeTimer)clearInterval(runtimeTimer);runtimeTimer=undefined}}catch{/* runtime source failure is rendered as unavailable on the next full refresh */}},1000)}
  async function select(id:string){
    const node=roadmapNodes.find(item=>item.id===id)||roadmapNodes.flatMap(item=>item.children).find(item=>item.id===id);
    if(!node)return;
    selectedEntity={type:node.type,id:node.id} as SelectedEntityRef;activeTab='概览';drawer=null;selectionRequest+=1;
    if(selectedEntity.type==='work_package')await readFormalWorkPackage(selectedEntity.id,selectionRequest);
  }
  function eligibility(id:ActionEligibility['id']){return context.availableActions.find(action=>action.id===id)}
  async function post(url:string,body:unknown){return request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}
  async function runAction(id:ActionEligibility['id']){
    const available=eligibility(id);
    if(!available?.enabled){setFeedback({state:'BLOCKED',title:'当前操作不可用',message:available?.reasonLabel??'当前实体或状态不允许此操作。',code:available?.reasonCode??'ACTION_NOT_AVAILABLE'});return}
    busy=true;
    const running:Record<string,[string,string,string]>={REFRESH:['正在刷新状态…','正在重建项目快照。','REFRESHING'],AUTHORIZE:['正在验证授权条件…','正在检查仓库状态与正式 Work Package。','AUTHORIZING'],START_CODEX:['正在启动 Codex…','正在验证匹配授权、仓库状态和 Writer Lock。','CODEX_STARTING'],STOP_CODEX:['正在停止 Codex…','正在请求当前 WP 的受管进程停止。','CODEX_STOPPING'],SAFE_MAIN_SYNC:['正在同步本地 main…','正在执行安全 fast-forward 检查。','SYNCING'],RETRY:['正在重试…','当前版本暂不支持重试。','RETRYING']};
    const copy=running[id];setFeedback({state:'RUNNING',title:copy[0],message:copy[1],code:copy[2]});
    try{
      if(id==='REFRESH')await loadSnapshot(false);
      if(id==='AUTHORIZE'&&selectedEntity.type==='work_package'){const requestedId=selectedEntity.id;const result=await post('/api/authorization',{workPackageId:requestedId,selectedEntityId:requestedId,confirmed:true});if(result.record?.workPackageId!==requestedId||result.record?.headShaAtAuthorization!==snapshot.repository.value?.head)throw new Error('AUTHORIZATION_PERSISTENCE_INTEGRITY_FAILED');await loadSnapshot(false);await tick();const refreshedSnapshot=createProjectSnapshot(raw);const refreshed=resolveEntityContext(refreshedSnapshot,selectedEntity);if(refreshed.type!=='work_package'||refreshed.id!==requestedId||refreshed.authorization.state!=='VALID'||refreshed.authorization.record?.workPackageId!==requestedId||refreshed.authorization.record?.headShaAtAuthorization!==refreshedSnapshot.repository.value?.head)throw new Error('AUTHORIZATION_POSTCONDITION_FAILED');}
      if(id==='START_CODEX'&&selectedEntity.type==='work_package'){const startContext=resolveEntityContext(createProjectSnapshot(raw),selectedEntity);if(startContext.type!=='work_package'||startContext.authorization.state!=='VALID'||startContext.authorization.record?.workPackageId!==selectedEntity.id)throw new Error('TARGET_CONTEXT_MISMATCH');await post('/api/codex/start',{workPackageId:selectedEntity.id});startRuntimePolling();}
      if(id==='STOP_CODEX')await post('/api/codex/stop',{});
      if(id==='SAFE_MAIN_SYNC')await post('/api/repository/sync-main',{});
      await loadSnapshot(false);
      const success:Record<string,[string,string]>={REFRESH:['状态已刷新','REFRESH_SUCCESS'],AUTHORIZE:['Owner 授权已创建','AUTHORIZATION_SUCCESS'],START_CODEX:['Codex 已启动','CODEX_STARTED'],STOP_CODEX:['Codex 已停止','CODEX_STOPPED'],SAFE_MAIN_SYNC:['本地 main 已同步','SYNC_SUCCESS'],RETRY:['重试完成','RETRY_SUCCESS']};
      setFeedback({state:'SUCCESS',title:success[id][0],message:'最新结果已写入当前实体上下文。',code:success[id][1]});
    }catch(error){const message=error instanceof Error?error.message:'ACTION_ERROR';setFeedback({state:'ERROR',title:'Owner 操作未完成',message,code:message.split(':')[0],next:'刷新状态并检查当前实体证据。'})}finally{busy=false}
  }
  function resize(side:'left'|'right',event:PointerEvent){const startX=event.clientX,start=side==='left'?leftWidth:rightWidth;const move=(next:PointerEvent)=>{const value=Math.max(side==='left'?240:260,Math.min(420,start+(side==='left'?next.clientX-startX:startX-next.clientX)));if(side==='left')leftWidth=value;else rightWidth=value};const up=()=>{removeEventListener('pointermove',move);removeEventListener('pointerup',up);localStorage.setItem(`aicc-v2-${side}-width`,String(side==='left'?leftWidth:rightWidth))};addEventListener('pointermove',move);addEventListener('pointerup',up)}
  onMount(()=>{leftWidth=+localStorage.getItem('aicc-v2-left-width')!||320;rightWidth=+localStorage.getItem('aicc-v2-right-width')!||320;void loadSnapshot(false).then(()=>{if(raw.runtime&&['STARTING','RUNNING','STOPPING'].includes(raw.runtime.phase))startRuntimePolling()})});onDestroy(()=>{if(runtimeTimer)clearInterval(runtimeTimer)});
</script>

<svelte:head><title>AICC V2 · Control Center</title><meta name="viewport" content="width=device-width, initial-scale=1"/></svelte:head>
<div class="app-shell">
  <header class="global-header"><div class="brand"><div class="brand-icon">A</div><div><strong>AI Control Center</strong><span>V2 · Local Web First</span></div></div><div class="header-context"><span class="status-dot"></span>本地工作区 <span class="mono">AIcontrolcenter</span></div><div class="header-actions"><button class="mobile-trigger" aria-label="打开路线图" onclick={()=>drawer=drawer==='roadmap'?null:'roadmap'}>☰</button><span class="branch-badge">{snapshot.repository.value?.branch??'repository unavailable'}</span><button class="mobile-trigger" aria-label="打开证据" onclick={()=>drawer=drawer==='status'?null:'status'}>◌</button></div></header>
  <div class="workspace" style={`--left-width:${leftWidth}px;--right-width:${rightWidth}px`}>
    <aside class:drawer-open={drawer==='roadmap'} class="roadmap panel"><div class="panel-header"><div><span class="kicker">01 / ROADMAP</span><h2>项目路线图</h2></div></div><div class="roadmap-source"><span class="live-dot"></span>唯一展示来源<code>{snapshot.roadmapSource}</code></div><RoadmapTree nodes={roadmapNodes} selectedId={selectedEntity.id} onSelect={select}/></aside>
    <div class="resize-handle" onpointerdown={(event)=>resize('left',event)} role="separator" aria-label="调整路线图宽度"></div>
    <main class="center panel"><div class="center-inner">
      <EntityHeader {context}/>
      {#if context.type==='milestone'}
        <MilestoneView context={context}/>
      {:else if context.type==='work_package'}
        <OwnerActionZone context={context} {busy} codexAvailable={Boolean(codexInfo?.available)} onAction={runAction}/>
        <div class="feedback-bar {feedback.state.toLowerCase()}" data-testid="owner-action-feedback" data-feedback-state={feedback.state.toLowerCase()}><div class="feedback-state">{feedback.state}</div><div><strong>{feedback.title}</strong><p>{feedback.message}</p>{#if feedback.code}<code>{feedback.code}</code>{/if}{#if feedback.next}<small>下一步：{feedback.next}</small>{/if}</div></div>
        <section class="workflow-section"><div class="section-label"><span>Workflow</span><small>WP 9-stage lifecycle</small></div><WorkflowTimeline stages={context.lifecycle.stages} currentStage={context.lifecycle.currentStage}/><div class="current-stage"><strong>当前阶段：{context.lifecycle.currentStage}</strong><p>{context.lifecycle.currentStage==='HUMAN_UAT'?'等待 Owner 完成真实 UI Human UAT。':'当前阶段由统一生命周期解析器确定。'}</p></div></section>
        <StatusTabs active={activeTab} statuses={tabStatuses} onSelect={(tab)=>activeTab=tab}/>
        <section class="tab-content">{#if activeTab==='运行'}<p>当前 WP Runtime：{context.runtime?.phase??'无匹配运行'}</p>{:else if activeTab==='验证'}<p>Validation：{context.lifecycle.stages.find(stage=>stage.id==='VALIDATION')?.status}</p>{:else if activeTab==='UAT'}<p>Human UAT：{context.humanUat?.status??'UNAVAILABLE / ABSENT'}</p>{:else if activeTab==='证据'}<p>{context.evidence.join(' · ')}</p>{:else}<p>{context.statusLabel} · {context.formalization}</p>{/if}</section>
        <section class="overview"><div class="section-label"><span>Work Package detail</span><small>Read-only normalized source</small></div>{#if context.formalWorkPackage}<article class="detail-card"><div class="detail-top"><span class="tag">{context.id}</span><span class="truth">FORMAL READY</span></div><h3>{context.formalWorkPackage.title}</h3><p class="source-path">{context.formalWorkPackage.source}</p><div class="detail-grid"><div><b>Goal / Scope</b><p>{context.formalWorkPackage.sections.Goal??'未提供'}</p></div><div><b>Status</b><p>{context.formalWorkPackage.fields.Status??'未提供'}</p></div><div><b>Dependencies</b><p>{context.formalWorkPackage.sections.Dependencies??'未提供'}</p></div><div><b>Acceptance Criteria</b><p>{context.formalWorkPackage.sections['Acceptance Criteria']??'未提供'}</p></div></div></article>{:else}<article class="detail-card"><div class="detail-top"><span class="tag">{context.id}</span><span class="kicker">PLANNED_ONLY</span></div><h3>Roadmap Work Package</h3><p>当前仅存在于 Roadmap；尚无有效正式可执行 Work Package 文件。</p></article>{/if}</section>
      {:else}<section class="milestone-view"><div class="milestone-badge">[PR]</div><h2>{context.title}</h2><p>PR 视图将在后续工作包实现；当前没有生产 PR 证据。</p></section>{/if}
    </div></main>
    <div class="resize-handle" onpointerdown={(event)=>resize('right',event)} role="separator" aria-label="调整状态宽度"></div>
    <aside class:drawer-open={drawer==='status'} class="status panel"><div class="panel-header"><div><span class="kicker">03 / EVIDENCE</span><h2>状态与证据</h2></div></div><EntityEvidencePanel {context} repository={snapshot.repository.value} {codexInfo}/></aside>
  </div>
</div>
