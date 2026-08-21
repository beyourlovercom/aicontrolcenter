<script lang="ts">
  import type {RuntimeDiagnostic} from '../lib/runtimeDiagnostics.ts';
  export let diagnostic:RuntimeDiagnostic|null=null;
  export let compact=false;
  let copied=false;
  let copyTimer:number|undefined;
  $: expanded=Boolean(diagnostic&&['CODEX_SESSION_BACKEND','AICC_RUNTIME_STATE_CONFLICT','AICC_STALE_RUNTIME','AICC_BLOCKED','ENVIRONMENT_CREDENTIAL_REQUIRED','UNKNOWN'].includes(diagnostic.diagnosticCode));
  async function copyStderr(){if(!diagnostic?.stderr)return;await navigator.clipboard?.writeText(diagnostic.stderr);copied=true;if(copyTimer)clearTimeout(copyTimer);copyTimer=window.setTimeout(()=>copied=false,1400)}
</script>

{#if diagnostic}
  <section class:compact class="runtime-diagnostics diagnostics-{diagnostic.tone}" data-testid={compact?'runtime-diagnostics-right':'runtime-diagnostics-center'} data-diagnostic-code={diagnostic.diagnosticCode}>
    <div class="diagnostics-heading">
      <div><span class="diagnostics-kicker">故障诊断</span><strong>Diagnostics</strong></div>
      <details open={expanded}><summary>{expanded?'收起':'展开'}</summary>
        <div class="diagnostics-body">
          <div class="diagnostics-facts">
            <div><span>故障层 Origin</span><b>{diagnostic.diagnosticOrigin}</b></div>
            <div><span>诊断代码 Code</span><b class="mono">{diagnostic.diagnosticCode}</b></div>
            <div><span>失败原因 Summary</span><b>{diagnostic.summary}</b></div>
            {#if diagnostic.blockedReason}<div><span>堵塞原因</span><b>{diagnostic.blockedReason}</b></div>{/if}
            <div><span>建议动作 Action</span><b>{diagnostic.requiredAction}</b></div>
            {#if compact}<div><span>置信度 Confidence</span><b>{diagnostic.confidence}</b></div>{/if}
          </div>
          <div class="diagnostics-evidence"><span>关键证据 Evidence</span>{#if diagnostic.evidence.length}<ul>{#each diagnostic.evidence as item}<li>{item}</li>{/each}</ul>{:else}<p>暂无可确认的证据，不推断故障原因。</p>{/if}</div>
          {#if diagnostic.stderrExcerpt}<div class="diagnostics-stderr"><div><span>Codex 原始反馈 stderr</span>{#if diagnostic.stderr}<button type="button" onclick={copyStderr}>{copied?'已复制':'复制完整 stderr'}</button>{/if}</div><pre>{compact?diagnostic.stderrExcerpt:diagnostic.stderr??diagnostic.stderrExcerpt}</pre>{#if compact&&diagnostic.stderr&&diagnostic.stderr!==diagnostic.stderrExcerpt}<details><summary>查看完整 stderr</summary><pre>{diagnostic.stderr}</pre></details>{/if}</div>{/if}
          <div class="diagnostics-process"><span>Process</span><b>PID: {diagnostic.pid??'NOT_AVAILABLE'} · exitCode: {diagnostic.processExitCode??'NOT_AVAILABLE'} · failure: {diagnostic.failure??'—'} · processExit: {diagnostic.processExitObserved?'OBSERVED':'NO'} · processClose: {diagnostic.processCloseObserved?'OBSERVED':'NO'}</b></div>
          {#if diagnostic.threadId}<div class="diagnostics-thread"><span>Thread ID</span><code>{diagnostic.threadId}</code></div>{/if}
        </div>
      </details>
    </div>
  </section>
{/if}

<style>
  .runtime-diagnostics{display:grid;gap:10px;padding:12px;border:1px solid var(--border);border-left:3px solid #c2413b;border-radius:var(--radius-md);background:var(--surface);box-shadow:var(--shadow-panel)}
  .runtime-diagnostics.diagnostics-warning{border-left-color:#d97706}.runtime-diagnostics.diagnostics-neutral{border-left-color:var(--border)}
  .diagnostics-heading{display:grid;gap:6px}.diagnostics-heading>div{display:flex;align-items:baseline;gap:8px}.diagnostics-kicker{font-size:12px;font-weight:650}.diagnostics-heading strong{color:var(--text-3);font:10px var(--font-tech)}
  .diagnostics-heading details{min-width:0}.diagnostics-heading summary{width:max-content;color:var(--text-2);font-size:11px;cursor:pointer}.diagnostics-body{display:grid;gap:10px;margin-top:10px}.diagnostics-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.diagnostics-facts div,.diagnostics-evidence,.diagnostics-process,.diagnostics-thread{min-width:0;padding:8px;border-radius:6px;background:var(--surface-soft)}.diagnostics-facts span,.diagnostics-evidence>span,.diagnostics-process>span,.diagnostics-thread>span{display:block;margin-bottom:4px;color:var(--text-3);font-size:10px}.diagnostics-facts b,.diagnostics-process b{display:block;color:var(--text-1);font-size:11px;overflow-wrap:anywhere}.mono,.diagnostics-thread code{font:10px var(--font-tech);overflow-wrap:anywhere}.diagnostics-evidence ul{margin:0;padding-left:16px;color:var(--text-2);font:11px/1.45 var(--font-tech)}.diagnostics-evidence p{margin:0;color:var(--text-3);font-size:11px}.diagnostics-stderr{min-width:0}.diagnostics-stderr>div{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px}.diagnostics-stderr span{color:var(--text-3);font-size:10px}.diagnostics-stderr button{border:1px solid var(--border);border-radius:5px;background:var(--surface-2);color:var(--text-2);padding:4px 7px;font-size:10px;cursor:pointer}.diagnostics-stderr pre{max-height:190px;margin:0;overflow:auto;padding:9px;border-radius:6px;background:#17202b;color:#d9e4ee;white-space:pre-wrap;overflow-wrap:anywhere;font:10px/1.45 var(--font-tech)}.diagnostics-stderr details{margin-top:6px}.diagnostics-stderr details summary{color:var(--text-2);font-size:10px;cursor:pointer}.diagnostics-thread code{display:block}.runtime-diagnostics.compact{padding:10px;box-shadow:none}.runtime-diagnostics.compact .diagnostics-facts{grid-template-columns:1fr 1fr}.runtime-diagnostics.compact .diagnostics-process{display:none}@media(max-width:900px){.diagnostics-facts{grid-template-columns:1fr 1fr}.runtime-diagnostics.compact .diagnostics-facts{grid-template-columns:1fr}}
</style>
