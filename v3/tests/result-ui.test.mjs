import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const here=dirname(fileURLToPath(import.meta.url));const root=join(here,'..');
const html=readFileSync(join(root,'public','index.html'),'utf8');
const app=readFileSync(join(root,'public','app.js'),'utf8');

test('canonical Result UI is read-only and evidence-oriented',()=>{
  for(const text of ['Canonical Result','Executor-provided Result','Result ID','Bound Run','Content SHA-256','Raw SHA-256'])assert.ok(html.includes(text));
  assert.ok(html.includes('AICC does not rewrite, summarize, translate, or infer PASS from Result presence.'));
  assert.equal(html.includes('result-form'),false);assert.equal(html.includes('Edit Result'),false);assert.equal(html.includes('Mark PASS'),false);
});

test('Result UI uses only exact GET endpoint and never derives semantic status',()=>{
  assert.ok(app.includes("api(`/api/runs/${encodeURIComponent(run.runId)}/result`)"));
  assert.ok(app.includes("$('result-content').textContent=result.content"));
  assert.equal(app.includes('result.status'),false);assert.equal(app.includes('result.pass'),false);assert.equal(app.includes('result.fail'),false);
  assert.equal(app.includes('exitCode===0'),false);assert.equal(app.includes('exitCode === 0'),false);
});
