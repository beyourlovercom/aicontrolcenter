import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const js = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const factsLib = await readFile(new URL('../lib/project-facts.mjs', import.meta.url), 'utf8');
const contextLib = await readFile(new URL('../lib/gpt-context.mjs', import.meta.url), 'utf8');

test('V4.2 exposes accepted Project Switcher and All Projects shell', () => {
  assert.match(html, /id="switcherButton"/);
  assert.match(html, /id="switcherMenu"/);
  assert.match(html, /id="main"/);
  assert.match(js, /所有项目/);
  assert.match(js, /viewProjectId/);
  assert.match(css, /\.project-grid/);
});

test('project switching is view-only and UI has no mutation request', () => {
  assert.match(js, /localStorage\.setItem\('aicc\.v4\.viewProjectId'/);
  assert.doesNotMatch(js, /method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i);
  assert.doesNotMatch(js, /git\s+checkout|checkoutBranch|executor\/|startRun|startExecutor/i);
});

test('dashboard labels GitHub provenance and avoids invented progress percentages', () => {
  assert.match(js, /GitHub 事实来源/);
  assert.match(js, /GitHub 事实源/);
  assert.doesNotMatch(js, /82%|68%|46%|31%/);
});


test('V4.3 exposes collapsible Development Tree and center detail view', () => {
  assert.match(js, /项目目录/);
  assert.match(js, /路线图/);
  assert.match(js, /工作包 \/ 任务/);
  assert.match(js, /合并请求/);
  assert.match(js, /待我处理/);
  assert.match(css, /\.development-tree/);
  assert.match(css, /\.detail-pane/);
});

test('tree expand collapse state is view-only and persisted per project', () => {
  assert.match(js, /aicc\.v4\.treeState\.\$\{projectId\}/);
  assert.match(js, /saveTreeState/);
  assert.doesNotMatch(js, /method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i);
});

test('V4.5 exposes explicit GitHub-backed Owner Attention without PR or CI heuristics', () => {
  assert.match(html, /id="attentionButton"/);
  assert.match(js, /renderOwnerAttentionCenter/);
  assert.match(js, /暂无 GitHub 明确待我处理事项/);
  assert.match(js, /仅显示 GitHub 明确待办/);
  assert.match(factsLib, /owner-merge/);
  assert.match(factsLib, /Owner Attention\|Owner Gate/);
  assert.doesNotMatch(js, /draft\s*&&.*attention|success.*ownerAttention/i);
});


test('V4.4 renders only evidence-backed progress and exact freshness states', () => {
  assert.match(js, /progressLabel/);
  assert.match(js, /GitHub Markdown 检查项/);
  assert.match(js, /freshness\?\$\{params\}/);
  assert.match(factsLib, /STALE/);
  assert.match(factsLib, /DRIFT/);
  assert.match(js, /DRIFT/);
  assert.doesNotMatch(js, /82%|68%|46%|31%/);
});


test('V4.6 exposes three-machine runtime evidence without machine control', () => {
  assert.match(html, /id="runtimeButton"/);
  assert.match(js, /renderRuntimeOverview/);
  assert.match(js, /STALE_OBSERVATION/);
  assert.match(js, /\/api\/runtime/);
  assert.match(css, /\.runtime-grid/);
  assert.doesNotMatch(js, /pingDevice|shutdown|start_process|switchBranch|machineControl/i);
});


test('V4.7 exposes copyable GPT Context and advisory Suggested Next without execution authority', () => {
  assert.match(html, /id="contextButton"/);
  assert.match(js, /复制 GPT 上下文/);
  assert.match(js, /建议下一步/);
  assert.match(js, /\/api\/projects\/\$\{encodeURIComponent\(projectId\)\}\/context/);
  assert.match(contextLib, /GitHub is the only project Source of Truth/);
  assert.match(contextLib, /Suggested Next \(ADVISORY\)/);
  assert.match(contextLib, /Open PR existence never|Reconcile its exact head|exact head, review state and CI/i);
  assert.doesNotMatch(js, /method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i);
  assert.doesNotMatch(contextLib, /merge now|deploy now|start executor|switch branch/i);
});

test('UI Localization V1 renders Chinese presentation while preserving engineering identifiers', () => {
  for (const label of ['刷新 GitHub','GPT 上下文','所有项目','项目目录','路线图','工作包 / 任务','合并请求','待我处理','当前主线','当前工作包','当前任务','路线图进度','数据状态','运行证据','建议下一步','事实来源']) {
    assert.match(html + js, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const label of ['FRESH','STALE','DRIFT','ONLINE','OFFLINE']) assert.match(js, new RegExp(label));
  assert.match(js, /FRESH:'最新'/);
  assert.match(js, /STALE:'已过期'/);
  assert.match(js, /DRIFT:'已漂移'/);
  assert.doesNotMatch(html, />Refresh GitHub<|>All Projects<|GitHub-backed Development Dashboard/);
});

test('V4.8 hardens repeated refreshes against stale response overwrite', () => {
  assert.match(js, /let refreshEpoch = 0/);
  assert.match(js, /const epoch = \+\+refreshEpoch/);
  assert.match(js, /epoch !== refreshEpoch/);
  assert.match(js, /refreshButton\.disabled = state\.loading/);
});
