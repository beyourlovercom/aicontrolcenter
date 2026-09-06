import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const html=readFileSync(join(root,'public/index.html'),'utf8');
const app=readFileSync(join(root,'public/app.js'),'utf8');

test('minimal WP Task UI exposes only frozen V3.4 controls',()=>{
  assert.match(html,/id="wp-form"/);
  assert.match(html,/id="task-form"/);
  assert.match(html,/id="wp-list"/);
  assert.match(html,/id="task-list"/);
  assert.doesNotMatch(html,/delete|rebind/i);
  assert.doesNotMatch(app,/method:\s*['"]DELETE['"]/);
});

test('UI consumes frozen APIs and reloads persisted work facts after mutations',()=>{
  assert.match(app,/api\('\/api\/work'/);
  assert.match(app,/\/api\/work-packages/);
  assert.match(app,/\/api\/tasks/);
  assert.match(app,/method:'POST'/);
  assert.match(app,/method:'PATCH'/);
  const reloads=(app.match(/await loadWork\(\)/g)||[]).length;
  assert.ok(reloads>=3,`expected persisted reload after each mutation, saw ${reloads}`);
});
