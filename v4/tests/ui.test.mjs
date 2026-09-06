import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const js = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');

test('V4.2 exposes accepted Project Switcher and All Projects shell', () => {
  assert.match(html, /id="switcherButton"/);
  assert.match(html, /id="switcherMenu"/);
  assert.match(html, /id="main"/);
  assert.match(js, /All Projects/);
  assert.match(js, /viewProjectId/);
  assert.match(css, /\.project-grid/);
});

test('project switching is view-only and UI has no mutation request', () => {
  assert.match(js, /localStorage\.setItem\('aicc\.v4\.viewProjectId'/);
  assert.doesNotMatch(js, /method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i);
  assert.doesNotMatch(js, /git\s+checkout|checkoutBranch|executor\/|startRun|startExecutor/i);
});

test('dashboard labels GitHub provenance and avoids invented progress percentages', () => {
  assert.match(js, /GITHUB PROVENANCE/);
  assert.match(js, /GitHub source/);
  assert.doesNotMatch(js, /82%|68%|46%|31%/);
});


test('V4.3 exposes collapsible Development Tree and center detail view', () => {
  assert.match(js, /PROJECT TREE/);
  assert.match(js, /Roadmap/);
  assert.match(js, /WP \/ Task/);
  assert.match(js, /Pull Requests/);
  assert.match(js, /Owner Attention/);
  assert.match(css, /\.development-tree/);
  assert.match(css, /\.detail-pane/);
});

test('tree expand collapse state is view-only and persisted per project', () => {
  assert.match(js, /aicc\.v4\.treeState\.\$\{projectId\}/);
  assert.match(js, /saveTreeState/);
  assert.doesNotMatch(js, /method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i);
});

test('Owner Attention is reserved for V4.5 instead of fabricated from heuristics', () => {
  assert.match(js, /Owner Attention projection starts in V4\.5/);
});
