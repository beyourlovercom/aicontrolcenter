import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadMachineRegistry, readRuntimeOverview } from '../lib/runtime-overview.mjs';

const machines = { schema:'aicc.v4.machine-registry.v1', machines:[{ id:'cn-mac', name:'CN Mac', deviceId:'11111111-1111-4111-8111-111111111111', role:'Primary Development' },{ id:'windows', name:'Windows', deviceId:'22222222-2222-4222-8222-222222222222', role:'Development' }] };

async function fixture(observation) {
  const dir = await mkdtemp(join(tmpdir(), 'aicc-runtime-'));
  const registryPath = join(dir, 'machines.json');
  const observationPath = join(dir, 'runtime.json');
  await writeFile(registryPath, JSON.stringify(machines));
  if (observation) await writeFile(observationPath, JSON.stringify(observation));
  return { registry: await loadMachineRegistry(registryPath), observationPath };
}

test('fresh DC observation projects online runtime evidence without becoming project truth', async () => {
  const observation = { schema:'aicc.v4.runtime-observation.v1', source:'remote-desktop-commander', observedAt:'2026-09-06T10:00:00Z', devices:[{ deviceId:machines.machines[0].deviceId, status:'online', lastSeen:'2026-09-06T09:59:59Z', hostname:'cn.example', platform:'Darwin', projectIds:['aicc'], observations:[{ repository:'beyourlovercom/aicontrolcenter', branch:'feat/runtime', runtime:'V4.6' }] }] };
  const { registry, observationPath } = await fixture(observation);
  const result = await readRuntimeOverview(registry, observationPath, { now:() => new Date('2026-09-06T10:01:00Z') });
  assert.equal(result.observationState, 'FRESH_OBSERVATION');
  assert.equal(result.machines[0].status, 'ONLINE');
  assert.deepEqual(result.machines[0].projectIds, ['aicc']);
  assert.equal(result.machines[1].status, 'UNOBSERVED');
});

test('stale observation never presents old ONLINE report as current online', async () => {
  const observation = { schema:'aicc.v4.runtime-observation.v1', source:'remote-desktop-commander', observedAt:'2026-09-06T10:00:00Z', devices:[{ deviceId:machines.machines[0].deviceId, status:'online' }] };
  const { registry, observationPath } = await fixture(observation);
  const result = await readRuntimeOverview(registry, observationPath, { now:() => new Date('2026-09-06T10:10:01Z') });
  assert.equal(result.observationState, 'STALE_OBSERVATION');
  assert.equal(result.machines[0].status, 'STALE_OBSERVATION');
  assert.equal(result.machines[0].reportedStatus, 'ONLINE');
});

test('missing runtime observation stays explicitly unavailable instead of inferred', async () => {
  const { registry, observationPath } = await fixture(null);
  const result = await readRuntimeOverview(registry, observationPath);
  assert.equal(result.available, false);
  assert.equal(result.observationState, 'UNAVAILABLE');
  assert.ok(result.machines.every((machine) => machine.status === 'UNOBSERVED'));
});
