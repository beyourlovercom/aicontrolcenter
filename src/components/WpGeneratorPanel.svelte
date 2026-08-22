<script lang="ts">
  import {approveProposal,createProposal,matchRoadmap,parseRequirement,planWorkPackage,type GeneratedWorkPackageProposal} from '../lib/wpGenerationAgent.ts';
  import {readBrowserProjectContext} from '../lib/projectContextClient.ts';
  export let onApproved:(proposal:GeneratedWorkPackageProposal)=>void=()=>{};
  export let onExport:(proposal:GeneratedWorkPackageProposal)=>void=onApproved;
  let request='',proposal:GeneratedWorkPackageProposal|null=null,error='',status:'opened'|'generating'|'review'='opened';
  let steps:string[]=[];
  async function generate(){status='generating';proposal=null;error='';steps=['✓ Requirement Parsed'];try{await new Promise(resolve=>setTimeout(resolve,0));const {activeProject}=await readBrowserProjectContext();steps.push('✓ Active Project Bound','✓ Repository Resolved','✓ Architecture Loaded');const intent=parseRequirement(request),plan=planWorkPackage(intent),match=matchRoadmap(intent);steps.push('✓ Roadmap Matched','✓ Existing WP Checked');proposal=createProposal(intent,plan,match,activeProject.repositoryIdentity,activeProject);steps.push('✓ Proposal Generated');status='review'}catch(value){error=value instanceof Error?value.message:'PROJECT_CONTEXT_UNAVAILABLE';status='opened'}}
  function approve(){if(proposal){onExport(approveProposal(proposal));proposal=null;request='';status='opened'}}
</script>
<section class="wp-generator-panel" data-testid="wp-generator-panel" data-state={status}>
  <div class="section-label"><span>AICC AI 建议 WP</span><small>{status==='review'?'OWNER_REVIEW':status==='generating'?'ANALYZING':'Suggestion only · Owner review required'}</small></div>
  {#if status==='opened'}
    <label>描述你的需求<textarea bind:value={request} placeholder="例如：创建 M8.0 Multi Repository Workspace"></textarea></label>
    <button class="service-action" onclick={generate} disabled={!request.trim()}>开始分析</button>
  {:else if status==='generating'}
    <div class="analysis-progress" data-testid="analysis-progress"><strong>正在分析</strong>{#each steps as step}<span>{step}</span>{/each}</div>
  {:else if proposal}
    <div class="proposal-card" data-testid="generated-wp-proposal"><span>AI Suggestion · OWNER_REVIEW</span><h3>{proposal.title}</h3><dl><dt>Description</dt><dd>{proposal.description}</dd><dt>Project</dt><dd>{proposal.project?.name??'NOT_MATCHED'}</dd><dt>Repository</dt><dd>✓ {proposal.project?.repository_path??proposal.repository??'NOT_AVAILABLE'}</dd><dt>Architecture</dt><dd>{proposal.architecture?.stack??'NOT_AVAILABLE'}</dd><dt>Milestone / Phase</dt><dd>{proposal.milestone} · {proposal.phase}</dd><dt>Decision Summary</dt><dd>{proposal.decision_explanation.summary}</dd><dt>Risk</dt><dd>{proposal.decision_risk.risk_level} · {proposal.decision_risk.risk_score}</dd><dt>Risk Explanation</dt><dd>{proposal.decision_explanation.risk_explanation}</dd><dt>Governance Explanation</dt><dd>{proposal.decision_explanation.governance_explanation}</dd><dt>Next Action</dt><dd>{proposal.decision_explanation.next_action}</dd><dt>Risk Factors</dt><dd>{proposal.decision_risk.risk_factors.join(' · ')||'NONE'}</dd><dt>Confidence</dt><dd>{proposal.confidence}</dd><dt>Approval</dt><dd>{proposal.decision_risk.approval_requirement}</dd><dt>Execution Policy</dt><dd>{proposal.execution_policy}</dd><dt>Dependencies</dt><dd>{proposal.dependencies.join(' · ')||'NONE'}</dd></dl><div class="proposal-actions"><button class="service-action" onclick={()=>{proposal=null;status='opened'}}>Reject</button><button class="service-action" onclick={()=>{proposal=null;status='opened'}}>Edit</button><button class="service-action" onclick={approve}>Export to GitHub WP</button></div></div>
  {/if}
  {#if error}<p class="generator-error">{error}</p>{/if}
</section>
<style>.wp-generator-panel{display:grid;gap:10px;padding:14px;border:1px solid var(--border);border-radius:8px;background:var(--surface)}label{display:grid;gap:4px;font-size:11px}textarea{min-height:100px;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-1)}.analysis-progress,.proposal-card{display:grid;gap:8px}.analysis-progress span{color:var(--text-2);font-size:11px}.proposal-card h3{margin:0}.proposal-card dl{display:grid;grid-template-columns:130px 1fr;gap:6px;margin:0;font-size:11px}.proposal-card dt{color:var(--text-3)}.proposal-card dd{margin:0;overflow-wrap:anywhere}.proposal-actions{display:flex;gap:6px}.generator-error{color:var(--danger)}</style>
