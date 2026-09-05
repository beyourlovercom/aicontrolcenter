import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const here=dirname(fileURLToPath(import.meta.url));const root=join(here,'..');
const html=readFileSync(join(root,'public','index.html'),'utf8');
const app=readFileSync(join(root,'public','app.js'),'utf8');

test('PR Delivery UI exposes exact-head facts and Draft-only action',()=>{
  for(const text of ['PR Delivery','GitHub exact-head delivery facts','Exact-head Checks','Open PRs for this head','Create Draft PR'])assert.ok(html.includes(text));
  assert.ok(html.includes('AICC does not infer merge readiness or engineering PASS.'));
  for(const text of ['Merge PR','Close PR','Ready for review','Approve PR','Release','Deploy'])assert.equal(html.includes(text),false);
});

test('PR Delivery UI consumes frozen APIs and cannot override head or draft mode',()=>{
  assert.ok(app.includes("api('/api/pr-delivery')"));
  assert.ok(app.includes("api('/api/prs/draft',{method:'POST',body:{title,body,baseRef}})"));
  assert.equal(app.includes('headSha:'),false);assert.equal(app.includes('headRef:'),false);assert.equal(app.includes('draft:false'),false);
  assert.ok(app.includes("$('create-draft-pr').disabled=!ready||Boolean(existing)"));
  assert.equal(app.includes('mergeReady'),false);assert.equal(app.includes('safeToMerge'),false);
});
