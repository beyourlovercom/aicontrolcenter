<script lang="ts">
  import {onDestroy,onMount,tick} from 'svelte';
  import RoadmapTree from './components/RoadmapTree.svelte';
  import StatusTabs from './components/StatusTabs.svelte';
  import WorkflowTimeline from './components/WorkflowTimeline.svelte';
  import PRWorkflowTimeline from './components/PRWorkflowTimeline.svelte';
  import EntityHeader from './components/entity/EntityHeader.svelte';
  import EntityEvidencePanel from './components/entity/EntityEvidencePanel.svelte';
  import MilestoneView from './components/entity/MilestoneView.svelte';
  import OwnerActionZone from './components/entity/OwnerActionZone.svelte';
  import PrOwnerActionZone from './components/entity/PrOwnerActionZone.svelte';
  import CurrentContextLocator from './components/CurrentContextLocator.svelte';
  import RuntimeMonitor from './components/RuntimeMonitor.svelte';
  import HumanUatWorkspace from './components/entity/HumanUatWorkspace.svelte';
  import {createProjectSnapshot,type RawProjectSources} from './lib/model/projectModel';
  import {resolveEntityContext} from './lib/context/entityContext';
  import {resolvePrTabView} from './lib/context/prTabContent';
  import type {ActionEligibility,FormalWorkPackage,HumanUatRecord,SelectedEntityRef,WorkPackageEntityContext} from './lib/model/entityTypes';

  type Drawer='roadmap'|'status'|null;
  type Feedback={state:'IDLE'|'RUNNING'|'SUCCESS'|'BLOCKED'|'ERROR';title:string;message:string;code?:string;next?:string};
  let drawer:Drawer=null,leftWidth=320,rightWidth=320,leftCollapsed=false,rightCollapsed=false,busy=false,activeTab='概览',codexInfo:any=null,selectionRequest=0,runtimeTimer:number|undefined;
  let descriptions:{repositoryKey:string;entityType:string;entityId:string;description:string}[]=[];
  const SELECTION_KEY='aicc-v2-selected-entity';
  function readSelection():SelectedEntityRef|null{try{const hash=new URLSearchParams(window.location.hash.replace(/^#/,''));const value=hash.get('entity');if(value){const [type,id]=value.split(':');if((type==='milestone'||type==='work_package'||type==='pull_request')&&id)return {type,id} as SelectedEntityRef}const stored=JSON.parse(localStorage.getItem(SELECTION_KEY)||'null');if(stored&&(stored.type==='milestone'||stored.type==='work_package'||stored.type==='pull_request')&&typeof stored.id==='string')return stored as SelectedEntityRef}catch{}return null}
  let selectedEntity:SelectedEntityRef=readSelection()??{type:'milestone',id:'M1'};
  let raw:RawProjectSources={formalWorkPackages:{},localDevelopment:true};
  let feedback:Feedback={state:'IDLE',title:'等待 Owner 操作',message:'请选择上方操作。最近一次操作结果会保留在这里。'};
  $: snapshot=createProjectSnapshot(raw);
  $: context=resolveEntityContext(snapshot,selectedEntity);
  $: prTab=context.type==='pull_request'?resolvePrTabView(context,activeTab):null;
  $: roadmapNodes=snapshot.roadmap.value??[];
  $: descriptionKey=`${snapshot.repository.value?.repository??'local'}|${selectedEntity.type}|${selectedEntity.id}`;
  $: selectedDescription=descriptions.find(item=>`${item.repositoryKey}|${item.entityType}|${item.entityId}`===descriptionKey)?.description??context.title;
  $: tabStatuses=context.type==='work_package'?{概览:context.status,流程:context.status,工作包:context.formalization==='FORMAL_READY'?'PASS':'NOT_STARTED',运行:context.runtime&&['STARTING','RUNNING','STOPPING'].includes(context.runtime.phase)?'IN_PROGRESS':context.runtime?'PASS':'NOT_STARTED',验证:context.lifecycle.stages.find(stage=>stage.id==='VALIDATION')?.status??'N_A',UAT:context.lifecycle.stages.find(stage=>stage.id==='HUMAN_UAT')?.status??'N_A',证据:snapshot.repository.availability==='AVAILABLE'?'PASS':'BLOCKED'}:{};

  function setFeedback(value:Feedback){feedback=value}
  async function request(url:string,options?:RequestInit){const response=await fetch(url,options);const data=await response.json();if(!response.ok){const value=typeof data.error==='object'?data.error:{code:data.error,message:data.error};throw new Error(`${value.code??'ACTION_ERROR'}: ${value.message??'操作失败'}`)}return data}
  async function readFormalWorkPackage(id:string,token:number){if(raw.formalWorkPackages?.[id])return;try{const response=await fetch(`/api/work-packages/${encodeURIComponent(id)}`);if(response.status===404)return; if(!response.ok)throw new Error('FORMAL_WP_SOURCE_UNAVAILABLE');const workPackage=await response.json() as FormalWorkPackage;if(token===selectionRequest)raw={...raw,formalWorkPackages:{...raw.formalWorkPackages,[id]:workPackage}}}catch{if(token===selectionRequest)raw={...raw,sourceErrors:{...raw.sourceErrors,formalWorkPackages:'FORMAL_WP_SOURCE_UNAVAILABLE'}}}}
  async function loadSnapshot(showFeedback=true){
    if(showFeedback)setFeedback({state:'RUNNING',title:'正在刷新状态…',message:'正在重建项目快照与当前实体上下文。',code:'REFRESHING'});
    const selectedAtStart=selectedEntity;
    const runtimeQuery=selectedAtStart.type==='work_package'?`?workPackageId=${encodeURIComponent(selectedAtStart.id)}`:'';
    const [roadmapResult,repositoryResult,authorizationResult,runtimeResult,descriptionResult,uatResult,lifecycleEvidenceResult]=await Promise.allSettled([request('/api/roadmap'),request('/api/repository'),request(`/api/authorization?workPackageId=${encodeURIComponent(selectedAtStart.type==='work_package'?selectedAtStart.id:'')}`),request(`/api/codex/runtime${runtimeQuery}`),request('/api/entity-descriptions'),selectedAtStart.type==='work_package'?request(`/api/human-uat?workPackageId=${encodeURIComponent(selectedAtStart.id)}`):Promise.resolve({record:null}),selectedAtStart.type==='work_package'?request(`/api/lifecycle-evidence?workPackageId=${encodeURIComponent(selectedAtStart.id)}`):Promise.resolve({record:null})]);
    const sourceErrors:RawProjectSources['sourceErrors']={};
    const next:RawProjectSources={...raw,sourceErrors};
    if(roadmapResult.status==='fulfilled')next.roadmap=roadmapResult.value;else sourceErrors.roadmap='ROADMAP_UNAVAILABLE';
    if(repositoryResult.status==='fulfilled')next.repository=repositoryResult.value;else sourceErrors.repository='REPOSITORY_UNAVAILABLE';
    if(authorizationResult.status==='fulfilled')next.authorization=authorizationResult.value.record??null;else sourceErrors.authorizations='AUTHORIZATION_UNAVAILABLE';
    if(runtimeResult.status==='fulfilled'){next.runtime=runtimeResult.value.runtime??null;codexInfo=runtimeResult.value.info}else sourceErrors.runtime='RUNTIME_UNAVAILABLE';
    if(descriptionResult.status==='fulfilled')descriptions=descriptionResult.value.records??[];
    if(uatResult.status==='fulfilled'&&selectedAtStart.type==='work_package')next.humanUat=uatResult.value.record?[uatResult.value.record]:[];
    if(lifecycleEvidenceResult.status==='fulfilled'&&selectedAtStart.type==='work_package')next.lifecycleEvidence=lifecycleEvidenceResult.value.record?[lifecycleEvidenceResult.value.record]:[];
    raw=next;
    if(next.roadmap?.content){const hydrated=resolveHydratedSelection(createProjectSnapshot(next).roadmap.value??[]);if(hydrated.type!==selectedEntity.type||hydrated.id!==selectedEntity.id){selectedEntity=hydrated;activeTab='概览';selectionRequest+=1;persistSelection(hydrated);return loadSnapshot(false);}}
    if(selectedAtStart.type==='work_package')await readFormalWorkPackage(selectedAtStart.id,selectionRequest);
    if(showFeedback)setFeedback({state:'SUCCESS',title:'状态已刷新',message:'项目快照与当前实体上下文已重新构建。',code:'REFRESH_SUCCESS'});
  }
  async function saveDescription(value:string){const target={...selectedEntity};const response=await request(value.trim()?'/api/entity-descriptions':'/api/entity-descriptions',{method:value.trim()?'POST':'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({repositoryKey:snapshot.repository.value?.repository??'local',entityType:target.type,entityId:target.id,description:value})});if(target.type!==selectedEntity.type||target.id!==selectedEntity.id)throw new Error('DESCRIPTION_TARGET_MISMATCH');if(value.trim())descriptions=[...descriptions.filter(item=>!(item.repositoryKey===(snapshot.repository.value?.repository??'local')&&item.entityType===target.type&&item.entityId===target.id)),response.record];else descriptions=descriptions.filter(item=>!(item.repositoryKey===(snapshot.repository.value?.repository??'local')&&item.entityType===target.type&&item.entityId===target.id));setFeedback({state:'SUCCESS',title:value.trim()?'描述已保存':'已恢复默认描述',message:'Owner 本地描述元数据已更新。',code:value.trim()?'DESCRIPTION_SAVED':'DESCRIPTION_OVERRIDE_CLEARED'});}
  async function saveHumanUat(record:HumanUatRecord){try{const target=selectedEntity;if(target.type!=='work_package'||target.id!==record.workPackageId)throw new Error('UAT_TARGET_MISMATCH');const payload={...record,repository:snapshot.repository.value?.repository??record.repository};const response=await request(`/api/human-uat?workPackageId=${encodeURIComponent(record.workPackageId)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});raw={...raw,humanUat:[response.record]};await loadSnapshot(false);const override=record.decisionMode==='OWNER_OVERRIDE_PASS';setFeedback({state:'SUCCESS',title:override?'人工 UAT 已直接通过':'UAT 进度已保存',message:override?'Owner 直接通过已持久化，未逐项验收事实已保留。':'Owner Human UAT 记录已持久化。',code:override?'OWNER_OVERRIDE_PASS':record.status==='PASS'?'UAT_PASS_SAVED':'UAT_PROGRESS_SAVED'});}catch(error){const message=error instanceof Error?error.message:'UAT_OVERRIDE_ERROR';setFeedback({state:'ERROR',title:record.decisionMode==='OWNER_OVERRIDE_PASS'?'人工 UAT 直接通过失败':'UAT 保存失败',message,code:message.split(':')[0],next:'检查当前 Work Package 与本地服务状态。'});}}
  function startRuntimePolling(){if(runtimeTimer)clearInterval(runtimeTimer);runtimeTimer=window.setInterval(async()=>{try{const id=selectedEntity.type==='work_package'?`?workPackageId=${encodeURIComponent(selectedEntity.id)}`:'';const data=await request(`/api/codex/runtime${id}`);raw={...raw,runtime:data.runtime??null};codexInfo=data.info;if(!data.runtime||!['STARTING','RUNNING','STOPPING'].includes(data.runtime.phase)){if(runtimeTimer)clearInterval(runtimeTimer);runtimeTimer=undefined}}catch{/* runtime source failure is rendered as unavailable on the next full refresh */}},1000)}
  function findRoadmapNode(nodes:any[],id:string):any{for(const node of nodes){if(node.id===id)return node;const found=findRoadmapNode(node.children??[],id);if(found)return found}return null}
  function resolveHydratedSelection(nodes:any[]):SelectedEntityRef{const persisted=readSelection();if(persisted&&findRoadmapNode(nodes,persisted.id))return persisted;const active:any[]=[];const walk=(items:any[],parent:any=null)=>{for(const node of items){if(node.type==='work_package'&&['IN_PROGRESS','WAITING_OWNER','WAITING_UAT'].includes(node.status))active.push({node,parent});walk(node.children??[],node)}};walk(nodes);if(active.length===1)return {type:'work_package',id:active[0].node.id};if(active.length>1){const parents=[...new Set(active.map(item=>item.parent?.id).filter(Boolean))];return {type:'milestone',id:parents.length===1?parents[0]:(nodes[0]?.id??'M1')}}return {type:'milestone',id:nodes[0]?.id??'M1'};}
  function persistSelection(selection:SelectedEntityRef){try{localStorage.setItem(SELECTION_KEY,JSON.stringify(selection));history.replaceState(null,'',`#entity=${selection.type}:${selection.id}`)}catch{}}
  function roadmapPath(nodes:any[],id:string,path:any[]=[]):any[]{for(const node of nodes){if(node.id===id)return [...path,node];const found=roadmapPath(node.children??[],id,[...path,node]);if(found.length)return found}return []}
  async function locateSelectedEntity(){const path=roadmapPath(roadmapNodes,selectedEntity.id);if(!path.length)return;const stored:Record<string,boolean>={};try{Object.assign(stored,JSON.parse(localStorage.getItem('aicc-v2-roadmap-collapse')||'{}'))}catch{}for(const node of path)if(node.children?.length)stored[node.id]=true;localStorage.setItem('aicc-v2-roadmap-collapse',JSON.stringify(stored));await tick();const target=document.querySelector(`[data-roadmap-node="${CSS.escape(selectedEntity.id)}"]`) as HTMLElement|null;const container=document.querySelector('.roadmap-scroll-region') as HTMLElement|null;if(target&&container){const top=target.getBoundingClientRect().top-container.getBoundingClientRect().top+container.scrollTop;container.scrollTo({top:Math.max(0,top-container.clientHeight/2),behavior:'smooth'});target.classList.add('locate-highlight');window.setTimeout(()=>target.classList.remove('locate-highlight'),900)}}
  async function select(id:string){
    const node=findRoadmapNode(roadmapNodes,id);
    if(!node)return;
    selectedEntity={type:node.type,id:node.id} as SelectedEntityRef;activeTab='概览';drawer=null;selectionRequest+=1;persistSelection(selectedEntity);
    if(selectedEntity.type==='work_package')await readFormalWorkPackage(selectedEntity.id,selectionRequest);
  }
  function toggleSidebar(side:'roadmap'|'status'){
    if(window.matchMedia('(max-width: 900px)').matches){drawer=drawer===side?null:side;return}
    if(side==='roadmap')leftCollapsed=!leftCollapsed;else rightCollapsed=!rightCollapsed;
  }
  function eligibility(id:ActionEligibility['id']){return context.availableActions.find(action=>action.id===id)}
  async function post(url:string,body:unknown){return request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}
  async function runAction(id:ActionEligibility['id']){
    const available=eligibility(id);
    if(!available?.enabled){setFeedback({state:'BLOCKED',title:'当前操作不可用',message:available?.reasonLabel??'当前实体或状态不允许此操作。',code:available?.reasonCode??'ACTION_NOT_AVAILABLE'});return}
    busy=true;
    const running:Record<string,[string,string,string]>={REFRESH:['正在刷新状态…','正在重建项目快照。','REFRESHING'],AUTHORIZE:['正在验证授权条件…','正在检查仓库状态与正式 Work Package。','AUTHORIZING'],START_CODEX:['正在启动 Codex…','正在验证匹配授权、仓库状态和 Writer Lock。','CODEX_STARTING'],STOP_CODEX:['正在停止 Codex…','正在请求当前 WP 的受管进程停止。','CODEX_STOPPING'],SAFE_MAIN_SYNC:['正在同步本地 main…','正在执行安全 fast-forward 检查。','SYNCING'],RETRY:['正在重试…','当前版本暂不支持重试。','RETRYING'],PR_START_CODEX:['正在启动 PR Codex…','正在验证 PR 独立执行合同与 Runtime 绑定。','PR_CODEX_STARTING'],PR_OPEN:['正在打开 PR…','正在检查真实 GitHub PR 绑定。','PR_OPENING'],PR_RETRY:['正在重试 PR…','正在检查可重试的 PR 执行。','PR_RETRYING'],PR_STOP:['正在停止 PR…','正在检查活动 PR 执行。','PR_STOPPING'],PR_APPROVE_MERGE:['正在批准合并…','正在检查真实 PR、CI 与 Merge evidence。','PR_MERGE_CHECKING']};
    const copy=running[id];setFeedback({state:'RUNNING',title:copy[0],message:copy[1],code:copy[2]});
    try{
      if(id==='REFRESH')await loadSnapshot(false);
      if(id==='AUTHORIZE'&&selectedEntity.type==='work_package'){const requestedId=selectedEntity.id;const result=await post('/api/authorization',{workPackageId:requestedId,selectedEntityId:requestedId,confirmed:true});if(result.record?.workPackageId!==requestedId||result.record?.headShaAtAuthorization!==snapshot.repository.value?.head)throw new Error('AUTHORIZATION_PERSISTENCE_INTEGRITY_FAILED');await loadSnapshot(false);await tick();const refreshedSnapshot=createProjectSnapshot(raw);const refreshed=resolveEntityContext(refreshedSnapshot,selectedEntity);if(refreshed.type!=='work_package'||refreshed.id!==requestedId||refreshed.authorization.state!=='VALID'||refreshed.authorization.record?.workPackageId!==requestedId||refreshed.authorization.record?.headShaAtAuthorization!==refreshedSnapshot.repository.value?.head)throw new Error('AUTHORIZATION_POSTCONDITION_FAILED');}
      if(id==='START_CODEX'&&selectedEntity.type==='work_package'){const startContext=resolveEntityContext(createProjectSnapshot(raw),selectedEntity);if(startContext.type!=='work_package'||startContext.authorization.state!=='VALID'||startContext.authorization.record?.workPackageId!==selectedEntity.id)throw new Error('TARGET_CONTEXT_MISMATCH');await post('/api/codex/start',{workPackageId:selectedEntity.id});startRuntimePolling();}
      if(id==='STOP_CODEX')await post('/api/codex/stop',{});
      if(id==='SAFE_MAIN_SYNC')await post('/api/repository/sync-main',{});
      await loadSnapshot(false);
      const success:Record<string,[string,string]>={REFRESH:['状态已刷新','REFRESH_SUCCESS'],AUTHORIZE:['Owner 授权已创建','AUTHORIZATION_SUCCESS'],START_CODEX:['Codex 已启动','CODEX_STARTED'],STOP_CODEX:['Codex 已停止','CODEX_STOPPED'],SAFE_MAIN_SYNC:['本地 main 已同步','SYNC_SUCCESS'],RETRY:['重试完成','RETRY_SUCCESS'],PR_OPEN:['PR 已打开','PR_OPENED'],PR_RETRY:['PR 已重试','PR_RETRIED'],PR_STOP:['PR 已停止','PR_STOPPED'],PR_APPROVE_MERGE:['合并操作已完成','PR_MERGE_COMPLETED']};
      setFeedback({state:'SUCCESS',title:success[id][0],message:'最新结果已写入当前实体上下文。',code:success[id][1]});
    }catch(error){const message=error instanceof Error?error.message:'ACTION_ERROR';setFeedback({state:'ERROR',title:'Owner 操作未完成',message,code:message.split(':')[0],next:'刷新状态并检查当前实体证据。'})}finally{busy=false}
  }
  function resize(side:'left'|'right',event:PointerEvent){const startX=event.clientX,start=side==='left'?leftWidth:rightWidth;const move=(next:PointerEvent)=>{const value=Math.max(side==='left'?240:260,Math.min(420,start+(side==='left'?next.clientX-startX:startX-next.clientX)));if(side==='left')leftWidth=value;else rightWidth=value};const up=()=>{removeEventListener('pointermove',move);removeEventListener('pointerup',up);localStorage.setItem(`aicc-v2-${side}-width`,String(side==='left'?leftWidth:rightWidth))};addEventListener('pointermove',move);addEventListener('pointerup',up)}
  onMount(()=>{leftWidth=+localStorage.getItem('aicc-v2-left-width')!||320;rightWidth=+localStorage.getItem('aicc-v2-right-width')!||320;void loadSnapshot(false).then(()=>{if(raw.runtime&&['STARTING','RUNNING','STOPPING'].includes(raw.runtime.phase))startRuntimePolling()})});onDestroy(()=>{if(runtimeTimer)clearInterval(runtimeTimer)});
</script>

<svelte:head><title>AICC V2 · Control Center</title><meta name="viewport" content="width=device-width, initial-scale=1"/></svelte:head>
<div class="app-shell">
  <header class="global-header"><div class="brand"><div class="brand-icon">A</div><div><strong>AI Control Center</strong><span>V2 · Local Web First</span></div></div><div class="header-context"><span class="status-dot"></span>本地工作区 <span class="mono">AIcontrolcenter</span></div><div class="header-actions"><button class="sidebar-toggle" data-tooltip={leftCollapsed?'打开左侧 Roadmap':'关闭左侧 Roadmap'} aria-label={leftCollapsed?'打开左侧 Roadmap':'关闭左侧 Roadmap'} onclick={()=>toggleSidebar('roadmap')}>{leftCollapsed?'》':'《'}</button><span class="branch-badge">{snapshot.repository.value?.branch??'repository unavailable'}</span><button class="sidebar-toggle" data-tooltip={rightCollapsed?'打开右侧状态栏':'关闭右侧状态栏'} aria-label={rightCollapsed?'打开右侧状态栏':'关闭右侧状态栏'} onclick={()=>toggleSidebar('status')}>{rightCollapsed?'《':'》'}</button></div></header>
  <div class:left-collapsed={leftCollapsed} class:right-collapsed={rightCollapsed} class="workspace" style={`--left-width:${leftWidth}px;--right-width:${rightWidth}px`}>
    <aside class:drawer-open={drawer==='roadmap'} class="roadmap panel"><div class="panel-header"><div><span class="kicker">01 / ROADMAP</span><h2>项目路线图</h2></div></div><CurrentContextLocator context={context} onLocate={locateSelectedEntity}/><div class="roadmap-scroll-region"><div class="roadmap-scroll-content"><RoadmapTree nodes={roadmapNodes} selectedId={selectedEntity.id} onSelect={select}/></div></div><footer class="roadmap-footer"><span title={snapshot.roadmapSource}>数据来源：01_LIVING_ROADMAP.md</span></footer></aside>
    <div class="resize-handle" onpointerdown={(event)=>resize('left',event)} role="separator" aria-label="调整路线图宽度"></div>
    <main class="center panel"><div class="center-inner">
      <EntityHeader {context} description={selectedDescription} onSave={saveDescription}/>
      {#if context.type==='milestone'}
        <MilestoneView context={context} onSelect={select}/>
      {:else if context.type==='work_package'}
        <OwnerActionZone context={context} {busy} codexAvailable={Boolean(codexInfo?.available)} onAction={runAction}/>
        <div class="feedback-bar {feedback.state.toLowerCase()}" data-testid="owner-action-feedback" data-feedback-state={feedback.state.toLowerCase()}><div class="feedback-state">{feedback.state}</div><div><strong>{feedback.title}</strong><p>{feedback.message}</p>{#if feedback.code}<code>{feedback.code}</code>{/if}{#if feedback.next}<small>下一步：{feedback.next}</small>{/if}</div></div>
        <section class="workflow-section"><div class="section-label"><span>Workflow</span><small>WP 9-stage lifecycle</small></div><WorkflowTimeline stages={context.lifecycle.stages} currentStage={context.lifecycle.currentStage}/><div class="current-stage"><strong>当前阶段：{context.lifecycle.currentStage}</strong><p>{context.lifecycle.currentStage==='HUMAN_UAT'?'等待 Owner 完成真实 UI Human UAT。':'当前阶段由统一生命周期解析器确定。'}</p></div></section>
        <RuntimeMonitor runtime={context.runtime} workPackage={context.formalWorkPackage} writerLock={context.writerLock}/>
        <StatusTabs active={activeTab} statuses={tabStatuses} onSelect={(tab)=>activeTab=tab}/>
        <section class="tab-content">{#if activeTab==='运行'}<p>当前 WP Runtime：{context.runtime?.phase??'无匹配运行'}</p>{:else if activeTab==='验证'}<p>Validation：{context.lifecycle.stages.find(stage=>stage.id==='VALIDATION')?.status}</p>{:else if activeTab==='UAT'}<HumanUatWorkspace context={context} repository={snapshot.repository.value?.repository??'local'} record={context.humanUat} onSave={saveHumanUat}/>{:else if activeTab==='证据'}<p>{context.evidence.join(' · ')}</p>{:else}<p>{context.statusLabel} · {context.formalization}</p>{/if}</section>
        <section class="overview"><div class="section-label"><span>Work Package detail</span><small>Read-only normalized source</small></div>{#if context.formalWorkPackage}<article class="detail-card"><div class="detail-top"><span class="tag">{context.id}</span><span class="truth">FORMAL READY</span></div><h3>{context.formalWorkPackage.title}</h3><p class="source-path">{context.formalWorkPackage.source}</p><div class="detail-grid"><div><b>Goal / Scope</b><p>{context.formalWorkPackage.sections.Goal??'未提供'}</p></div><div><b>Status</b><p>{context.formalWorkPackage.fields.Status??'未提供'}</p></div><div><b>Dependencies</b><p>{context.formalWorkPackage.sections.Dependencies??'未提供'}</p></div><div><b>Acceptance Criteria</b><p>{context.formalWorkPackage.sections['Acceptance Criteria']??'未提供'}</p></div></div></article>{:else}<article class="detail-card"><div class="detail-top"><span class="tag">{context.id}</span><span class="kicker">PLANNED_ONLY</span></div><h3>Roadmap Work Package</h3><p>当前仅存在于 Roadmap；尚无有效正式可执行 Work Package 文件。</p></article>{/if}</section>

      {:else if prTab}<section class="pr-panel"><div class="section-label"><span>Pull Request Panel</span><small>PR 7-stage workflow</small></div><div class="pr-notice"><strong>[PR] PR #DEMO — Dual Panel Fixture</strong><span>DEMO · LOCAL FIXTURE · 仅用于本地视觉 UAT，不代表 GitHub 生产证据。</span><span>Parent: {context.parentWorkPackageId??'未匹配'}</span></div><PrOwnerActionZone context={context} {busy} onAction={runAction}/><div class="feedback-bar {feedback.state.toLowerCase()}" data-testid="pr-action-feedback"><div class="feedback-state">{feedback.state}</div><div><strong>{feedback.state==='IDLE'?'当前为 DEMO · LOCAL FIXTURE':feedback.title}</strong><p>{feedback.state==='IDLE'?'未绑定真实 GitHub PR，生产操作暂不可用。':feedback.message}</p>{#if feedback.code}<code>{feedback.code}</code>{/if}</div></div><PRWorkflowTimeline stages={context.stages} currentStage={context.currentStage}/><RuntimeMonitor runtime={null} workPackage={null} writerLock={{status:'NOT_HELD',scope:'repository'}} emptyTitle="暂无 PR 运行记录" emptyCapability="尚未绑定" emptyReason="PR_EXECUTION_CONTRACT_NOT_BOUND"/><StatusTabs active={activeTab} statuses={{}} tabs={context.tabs} onSelect={(tab)=>activeTab=tab}/><div class="pr-tab-view" data-testid="pr-tab-content" data-pr-tab={prTab.tab}><div class="section-label"><span>{prTab.title}</span><small>{prTab.tab}</small></div>{#if prTab.description}<p class="pr-tab-description">{prTab.description}</p>{/if}{#if prTab.tab==='流程'}<div class="pr-workflow-detail"><p>当前阶段：{context.currentStage}</p>{#each context.stages as stage}<div><span>{stage.label}</span><strong>{stage.status}</strong></div>{/each}</div>{/if}<div class="runtime-list">{#each prTab.rows as row}<div><span>{row[0]}</span><b>{row[1]}</b></div>{/each}</div></div></section>{/if}
    </div></main>
    <div class="resize-handle" onpointerdown={(event)=>resize('right',event)} role="separator" aria-label="调整状态宽度"></div>
    <aside class:drawer-open={drawer==='status'} class="status panel"><div class="panel-header"><div><span class="kicker">03 / EVIDENCE</span><h2>状态与证据</h2></div></div><EntityEvidencePanel {context} repository={snapshot.repository.value} {codexInfo}/></aside>
  </div>
</div>
