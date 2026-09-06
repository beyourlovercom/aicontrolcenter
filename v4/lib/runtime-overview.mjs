import { readFile } from 'node:fs/promises';

const MACHINE_ID = /^[a-z0-9-]+$/;
const DEVICE_ID = /^[0-9a-f-]{36}$/i;
const MAX_OBSERVATION_AGE_MS = 5 * 60 * 1000;

function freezeMachine(machine) {
  return Object.freeze({
    id: machine.id,
    name: machine.name,
    deviceId: machine.deviceId,
    role: machine.role
  });
}

export async function loadMachineRegistry(path) {
  const parsed = JSON.parse(await readFile(path, 'utf8'));
  if (parsed?.schema !== 'aicc.v4.machine-registry.v1' || !Array.isArray(parsed.machines) || !parsed.machines.length) throw new Error('invalid machine registry');
  const seenIds = new Set();
  const seenDevices = new Set();
  const machines = parsed.machines.map((machine) => {
    if (!MACHINE_ID.test(machine?.id ?? '') || typeof machine?.name !== 'string' || !machine.name.trim() || !DEVICE_ID.test(machine?.deviceId ?? '') || typeof machine?.role !== 'string' || !machine.role.trim()) throw new Error('invalid machine registry entry');
    if (seenIds.has(machine.id) || seenDevices.has(machine.deviceId)) throw new Error('duplicate machine registry entry');
    seenIds.add(machine.id); seenDevices.add(machine.deviceId);
    return freezeMachine(machine);
  });
  return Object.freeze({ schema: parsed.schema, machines: Object.freeze(machines) });
}

function normalizeObservationDevice(device) {
  return Object.freeze({
    deviceId: device.deviceId,
    reportedStatus: typeof device.status === 'string' ? device.status.toUpperCase() : 'UNKNOWN',
    lastSeen: typeof device.lastSeen === 'string' ? device.lastSeen : null,
    hostname: typeof device.hostname === 'string' ? device.hostname : null,
    platform: typeof device.platform === 'string' ? device.platform : null,
    projectIds: Object.freeze(Array.isArray(device.projectIds) ? device.projectIds.filter((value) => typeof value === 'string') : []),
    observations: Object.freeze(Array.isArray(device.observations) ? device.observations.map((item) => Object.freeze({
      repository: typeof item?.repository === 'string' ? item.repository : null,
      branch: typeof item?.branch === 'string' ? item.branch : null,
      runtime: typeof item?.runtime === 'string' ? item.runtime : null
    })) : [])
  });
}

export async function readRuntimeOverview(machineRegistry, observationPath, { now = () => new Date() } = {}) {
  let parsed;
  try { parsed = JSON.parse(await readFile(observationPath, 'utf8')); }
  catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return Object.freeze({
      schema: 'aicc.v4.runtime-overview.v1',
      available: false,
      source: 'remote-desktop-commander',
      observedAt: null,
      ageMs: null,
      observationState: 'UNAVAILABLE',
      machines: Object.freeze(machineRegistry.machines.map((machine) => Object.freeze({ ...machine, status: 'UNOBSERVED', reportedStatus: null, lastSeen: null, hostname: null, platform: null, projectIds: Object.freeze([]), observations: Object.freeze([]) })))
    });
  }
  if (parsed?.schema !== 'aicc.v4.runtime-observation.v1' || parsed?.source !== 'remote-desktop-commander' || typeof parsed?.observedAt !== 'string' || !Array.isArray(parsed.devices)) throw new Error('invalid runtime observation');
  const observedMs = Date.parse(parsed.observedAt);
  if (!Number.isFinite(observedMs)) throw new Error('invalid runtime observation timestamp');
  const ageMs = Math.max(0, now().getTime() - observedMs);
  const stale = ageMs > MAX_OBSERVATION_AGE_MS;
  const byDevice = new Map(parsed.devices.filter((device) => DEVICE_ID.test(device?.deviceId ?? '')).map((device) => [device.deviceId, normalizeObservationDevice(device)]));
  const machines = machineRegistry.machines.map((machine) => {
    const observation = byDevice.get(machine.deviceId);
    if (!observation) return Object.freeze({ ...machine, status: stale ? 'STALE_OBSERVATION' : 'UNOBSERVED', reportedStatus: null, lastSeen: null, hostname: null, platform: null, projectIds: Object.freeze([]), observations: Object.freeze([]) });
    return Object.freeze({ ...machine, ...observation, status: stale ? 'STALE_OBSERVATION' : observation.reportedStatus });
  });
  return Object.freeze({ schema: 'aicc.v4.runtime-overview.v1', available: true, source: parsed.source, observedAt: parsed.observedAt, ageMs, observationState: stale ? 'STALE_OBSERVATION' : 'FRESH_OBSERVATION', machines: Object.freeze(machines) });
}
