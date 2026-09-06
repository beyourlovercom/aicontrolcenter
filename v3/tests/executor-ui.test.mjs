import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const publicRoot=join(here,'..','public');
const html=readFileSync(join(publicRoot,'index.html'),'utf8');
const app=readFileSync(join(publicRoot,'app.js'),'utf8');

test('minimal execution UI exposes only frozen V3.5 actions',()=>{
  assert.match(html,/id="run-task"/);
  assert.match(html,/id="run-instruction"/);
  assert.match(html,/id="start-run"/);
  assert.match(html,/id="stop-run"/);
  assert.match(html,/Append-only Events/);
  assert.doesNotMatch(html,/Resume Run|Retry Run|Create PR|Merge PR|Semantic PASS/i);
});

test('execution UI consumes only frozen executor APIs and never infers PASS',()=>{
  assert.match(app,/api\/executor/);
  assert.match(app,/api\/runs/);
  assert.match(app,/\/events\?after=/);
  assert.match(app,/\/stop/);
  assert.match(html,/EXITED does not mean PASS/);
  assert.doesNotMatch(app,/state\s*===\s*['"]EXITED['"].*PASS|PASS.*state\s*===\s*['"]EXITED['"]/s);
});
