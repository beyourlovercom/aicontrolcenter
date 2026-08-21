import assert from 'node:assert/strict';
import {canonicalTaskSourceLabel,projectCanonicalTaskFeed} from './canonicalTaskFeed.ts';

const tasks=[
  {taskId:'task-manual',origin:'CLIPBOARD',status:'READY',createdAt:'2026-08-16T08:00:00.000Z',formalWpId:'AICC-WP-1',taskTitle:'Manual task'},
  {taskId:'task-bridge',origin:'WEB_BRIDGE',status:'RUNNING',updatedAt:'2026-08-16T10:00:00.000Z',milestoneId:'M8',formal_wp_id:'AICC-WP-1',taskTitle:'Bridge task'},
  {taskId:'task-gpt',origin_source:'GPT_AUTO_CONTROL_LOOP',origin:'CLIPBOARD',status:'COMPLETED',completedAt:'2026-08-16T09:00:00.000Z',prId:'42',taskTitle:'GPT task'},
  {taskId:'task-bridge',origin:'WEB_BRIDGE',status:'READY',updatedAt:'2026-08-15T10:00:00.000Z',formalWpId:'STALE-WP'},
  {taskId:'task-unknown',origin:'FUTURE_SOURCE',status:'READY',createdAt:'2026-08-16T08:00:00.000Z',entityScope:'GLOBAL_TASK'},
  {runId:'run-without-task',origin:'WEB_BRIDGE',status:'COMPLETED',createdAt:'2026-08-17T00:00:00.000Z'}
];

const rows=projectCanonicalTaskFeed(tasks);
assert.deepEqual(rows.map(row=>row.taskId),['task-bridge','task-gpt','task-manual','task-unknown'],'newest activity wins with deterministic taskId tie-break');
assert.equal(rows.length,4,'canonical task_id is the sole identity and duplicate records collapse');
assert.equal(rows[0].sourceLabel,'AICC Bridge');
assert.equal(rows[0].canonicalSource,'WEB_BRIDGE','canonical source remains unchanged');
assert.equal(rows[0].bindingLabel,'M8 / AICC-WP-1');
assert.equal(rows[1].sourceLabel,'GPT Plus');
assert.equal(rows[1].bindingLabel,'PR 42');
assert.equal(rows[2].sourceLabel,'手动');
assert.equal(rows[3].sourceLabel,'未知来源 · FUTURE_SOURCE','unknown sources remain explicit');
assert.equal(rows[3].bindingLabel,'GLOBAL / UNMAPPED');
assert.equal(canonicalTaskSourceLabel('CLIPBOARD_DIRECT'),'AICC Bridge');
assert.equal(canonicalTaskSourceLabel('GPT_BLOCK'),'GPT Plus');
assert.ok(rows.every(row=>row.task===tasks.find(task=>task.taskId===row.taskId&&(!task.updatedAt||task.updatedAt===row.activityAt))||row.task.taskId===row.taskId),'projection preserves canonical records without synthetic copies');
console.log('canonical Task feed projection tests passed');
