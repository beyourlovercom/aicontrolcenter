<script lang="ts">
 import type {HumanUatItem,HumanUatRecord,WorkPackageEntityContext} from '../../lib/model/entityTypes.ts';
 import {canPassHumanUat} from '../../lib/humanUat.ts';
 export let context:WorkPackageEntityContext;
 export let record:HumanUatRecord|null=null;
 export let onSave:(record:HumanUatRecord)=>void=()=>{};
 let items:HumanUatItem[]=[];
 $: criteria=(context.formalWorkPackage?.sections['Acceptance Criteria']??'').split(/\n|(?<=\.)\s+(?=-\s)/).map(value=>value.replace(/^\s*[-*]\s*/,'').trim()).filter(Boolean);
 $: items=criteria.map((title,index)=>record?.items.find(item=>item.id===`uat-${index+1}`)??{id:`uat-${index+1}`,title,description:title,state:'PENDING'});
 $: editable=context.lifecycle.currentStage==='HUMAN_UAT'||context.lifecycle.stages.find(stage=>stage.id==='HUMAN_UAT')?.status==='WAITING_UAT';
 $: currentStatus=record?.status??'NOT_STARTED';
 function label(state:string){return ({PENDING:'待验证',PASS:'通过',FAIL:'不通过',N_A:'不适用'})[state]??state}
 function updateItem(item:HumanUatItem,state:HumanUatItem['state']){const next=items.map(value=>value.id===item.id?{...value,state}:value);onSave(makeRecord(next,record?.overallNote??''))}
 function updateNote(item:HumanUatItem,event:Event){const note=(event.currentTarget as HTMLInputElement).value;onSave(makeRecord(items.map(value=>value.id===item.id?{...value,note}:value),record?.overallNote??''))}
 function makeRecord(nextItems=items,overallNote=record?.overallNote??'',status=record?.status??'NOT_STARTED'):HumanUatRecord{return {repository:context.parentMilestone?.id??'local',workPackageId:context.id,entityType:'work_package',status,ownerLabel:'Owner',items:nextItems,overallNote,createdAt:record?.createdAt??new Date().toISOString(),updatedAt:new Date().toISOString(),finalDecisionAt:record?.finalDecisionAt,source:'formal Work Package acceptance criteria'}}
 function saveProgress(){onSave(makeRecord(items,record?.overallNote??'',items.some(item=>item.state!=='PENDING')?'IN_PROGRESS':'NOT_STARTED'))}
 function remediate(){if(!items.some(item=>item.state==='FAIL')&&!record?.overallNote?.trim())return;onSave(makeRecord(items,record?.overallNote??'','NEEDS_REMEDIATION'))}
 function pass(){if(!canPassHumanUat(items))return;onSave(makeRecord(items,record?.overallNote??'','PASS'))}
 function overall(event:Event){onSave(makeRecord(items,(event.currentTarget as HTMLTextAreaElement).value,currentStatus))}
</script>
<section class="uat-workspace" data-testid="human-uat-workspace">
 <div class="section-label"><span>人工验收</span><small>Owner Human UAT</small></div>
 <div class="uat-summary"><div><span>验收状态</span><b>{currentStatus==='PASS'?'已通过':currentStatus==='IN_PROGRESS'?'验收中':currentStatus==='NEEDS_REMEDIATION'?'需整改':'待验收'}</b></div><div><span>负责人</span><b>{record?.ownerLabel??'Owner'}</b></div><div><span>验收进度</span><b>{items.filter(item=>item.state==='PASS').length} / {items.length}</b></div></div>
 {#if !editable}<p class="uat-not-ready">尚未进入人工验收阶段。当前仅提供验收清单预览。</p>{/if}
 <div class="uat-checklist"><h3>验收清单</h3>{#if items.length}{#each items as item,index}<div class="uat-item"><div class="uat-item-main"><strong>{index+1}. {item.title}</strong><small>{item.description}</small></div><div class="uat-item-controls">{#each [['PENDING','待验证'],['PASS','通过'],['FAIL','不通过'],['N_A','不适用']] as option}<button class:chosen={item.state===option[0]} disabled={!editable} onclick={()=>updateItem(item,option[0] as HumanUatItem['state'])}>{option[1]}</button>{/each}</div><input aria-label={`条目 ${index+1} Owner 备注`} value={item.note??''} placeholder="Owner 备注" disabled={!editable} onblur={(event)=>updateNote(item,event)}/></div>{/each}{:else}<p>暂无可解析的正式验收标准。</p>{/if}</div>
 <div class="uat-findings"><h3>问题记录</h3>{#each items.filter(item=>item.state==='FAIL') as item}<p><strong>{item.title}</strong>：{item.note??'需补充 Owner 备注'}</p>{:else}<p>暂无已记录问题。</p>{/each}</div>
 <label class="uat-overall-note">Owner 备注<textarea maxlength="2000" value={record?.overallNote??''} disabled={!editable} onblur={overall}></textarea></label>
 <div class="uat-actions"><button class="action" disabled={!editable} onclick={saveProgress}>保存进度</button><button class="action" disabled={!editable||(!items.some(item=>item.state==='FAIL')&&!record?.overallNote?.trim())} onclick={remediate}>标记需整改</button><button class="action primary" disabled={!editable||!canPassHumanUat(items)} onclick={pass}>通过 UAT</button></div>
</section>
