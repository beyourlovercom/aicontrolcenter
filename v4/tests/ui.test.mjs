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
