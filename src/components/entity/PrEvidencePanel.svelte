<script lang="ts">
  import type {PullRequestEntityContext} from '../../lib/model/entityTypes';
  export let context:PullRequestEntityContext;
  const demo=context.record?.fixture===true;
  const value=(v:string|number|undefined|null,empty='NOT_BOUND')=>v===undefined||v===null||v===''?empty:String(v);
</script>
<div class="pr-evidence-sections" data-testid="pr-right-evidence">
  <div class="evidence-intro"><span class="live-dot"></span><strong>PR 真实证据</strong></div>
  <section class="evidence-card"><h3>PR Identity / Source</h3><div class="evidence-fields"><div><span>PR Identity</span><b>{demo?'PR #DEMO — Dual Panel Fixture':context.record?.repository&&context.record?.number?`${context.record.repository}#${context.record.number}`:context.id}</b></div><div><span>Repository</span><b>{value(context.record?.repository,'ABSENT')}</b></div><div><span>PR Number</span><b>{value(context.record?.number,'ABSENT')}</b></div><div><span>Source</span><b>{demo?'DEMO · LOCAL FIXTURE':'PRODUCTION'}</b></div><div><span>Source branch</span><b>{value(context.record?.sourceBranch,'ABSENT')}</b></div><div><span>Delivery branch</span><b>{value(context.record?.deliveryBranch,'NOT_BOUND')}</b></div></div></section>
  <section class="evidence-card"><h3>Parent Work Package</h3><div class="evidence-fields"><div><span>Parent WP</span><b>{value(context.parentWorkPackageId,'ABSENT')}</b></div></div></section>
  <section class="evidence-card"><h3>PR Runtime</h3><div class="evidence-fields"><div><span>Runtime</span><b>ABSENT / no active PR execution</b></div><div><span>Writer Lock</span><b>NOT_HELD</b></div></div></section>
  <section class="evidence-card"><h3>Review</h3><div class="evidence-fields"><div><span>Review</span><b>NOT_RUN</b></div><div><span>Reviewer</span><b>NOT_BOUND</b></div></div></section>
  <section class="evidence-card"><h3>Exact-head CI</h3><div class="evidence-fields"><div><span>CI</span><b>NOT_RUN</b></div><div><span>CI Run</span><b>ABSENT</b></div></div></section>
  <section class="evidence-card"><h3>Merge / Merge Readiness</h3><div class="evidence-fields"><div><span>Mergeability</span><b>NOT_RUN</b></div><div><span>Ready to Merge</span><b>NOT_RUN</b></div><div><span>Merge Result</span><b>NOT_RUN</b></div></div></section>
  <section class="evidence-card"><h3>GitHub / Delivery Evidence</h3><div class="evidence-fields"><div><span>Production PR</span><b>ABSENT</b></div><div><span>GitHub PR</span><b>NOT_BOUND</b></div><div><span>PR HEAD</span><b>NOT_BOUND</b></div><div><span>Files Changed</span><b>{value(context.record?.filesChanged,'0')}</b></div></div></section>
</div>
