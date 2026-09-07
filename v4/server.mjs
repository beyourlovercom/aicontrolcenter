import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize } from 'node:path';
import { homedir } from 'node:os';
import { readFile } from 'node:fs/promises';
import { createGhApiClient } from './lib/github-client.mjs';
import { getProjectLocator, loadProjectRegistry } from './lib/project-registry.mjs';
import { compareProjectionFreshness, readAllGitHubProjectFacts, readGitHubProjectFacts, readGitHubProjectHead } from './lib/project-facts.mjs';
import { loadMachineRegistry, readRuntimeOverview } from './lib/runtime-overview.mjs';
import { createGptContextSnapshot } from './lib/gpt-context.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const defaultRegistryPath = join(here, 'projects.json');
const defaultMachineRegistryPath = join(here, 'machines.json');
const defaultRuntimeObservationPath = process.env.AICC_V4_RUNTIME_OBSERVATION || join(homedir(), '.aicc-v4', 'runtime-observation.json');
const publicRoot = join(here, 'public');
const contentTypes = Object.freeze({ '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8' });

async function sendStatic(response, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const safe = normalize(relative);
  if (safe.startsWith('..') || safe.includes('/../')) return false;
  try {
    const body = await readFile(join(publicRoot, safe));
    response.writeHead(200, { 'content-type': contentTypes[extname(safe)] ?? 'application/octet-stream', 'cache-control':'no-store' });
    response.end(body); return true;
  } catch { return false; }
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  response.end(JSON.stringify(body));
}

export async function createV4Server({ registryPath = defaultRegistryPath, machineRegistryPath = defaultMachineRegistryPath, runtimeObservationPath = defaultRuntimeObservationPath, client = createGhApiClient(), now = () => new Date() } = {}) {
  const registry = await loadProjectRegistry(registryPath);
  const machineRegistry = await loadMachineRegistry(machineRegistryPath);
  let projectsInFlight = null;
  const readProjects = () => {
    if (!projectsInFlight) {
      projectsInFlight = readAllGitHubProjectFacts(registry, { client, now }).finally(() => { projectsInFlight = null; });
    }
    return projectsInFlight;
  };
  return http.createServer(async (request, response) => {
    if (request.method !== 'GET') {
      sendJson(response, 405, { schema: 'aicc.v4.error.v1', error: 'READ_ONLY_API' });
      return;
    }
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/api/health') {
      sendJson(response, 200, { schema: 'aicc.v4.health.v1', ok: true, service: 'AICC_V4', projectCount: registry.projects.length, machineCount: machineRegistry.machines.length });
      return;
    }
    if (url.pathname === '/api/projects') {
      const projects = await readProjects();
      sendJson(response, 200, { schema: 'aicc.v4.projects.v1', projects });
      return;
    }
    if (url.pathname === '/api/runtime') {
      try { sendJson(response, 200, await readRuntimeOverview(machineRegistry, runtimeObservationPath, { now })); }
      catch (error) { sendJson(response, 502, { schema: 'aicc.v4.error.v1', error: 'RUNTIME_OBSERVATION_INVALID', detail: error.message }); }
      return;
    }
    const contextMatch = url.pathname.match(/^\/api\/projects\/([a-z0-9-]+)\/context$/);
    if (contextMatch) {
      const project = getProjectLocator(registry, contextMatch[1]);
      if (!project) { sendJson(response, 404, { schema: 'aicc.v4.error.v1', error: 'PROJECT_NOT_REGISTERED' }); return; }
      try {
        const facts = await readGitHubProjectFacts(project, { client, now });
        let runtime = null;
        try { runtime = await readRuntimeOverview(machineRegistry, runtimeObservationPath, { now }); } catch { runtime = null; }
        sendJson(response, 200, createGptContextSnapshot(facts, runtime, { now }));
      } catch (error) { sendJson(response, 502, { schema: 'aicc.v4.error.v1', error: error.code ?? 'GPT_CONTEXT_UNAVAILABLE', detail: error.message }); }
      return;
    }
    const freshnessMatch = url.pathname.match(/^\/api\/projects\/([a-z0-9-]+)\/freshness$/);
    if (freshnessMatch) {
      const project = getProjectLocator(registry, freshnessMatch[1]);
      if (!project) { sendJson(response, 404, { schema: 'aicc.v4.error.v1', error: 'PROJECT_NOT_REGISTERED' }); return; }
      const expectedRef = url.searchParams.get('ref');
      const expectedRepository = url.searchParams.get('repository');
      if (!expectedRef || !/^[0-9a-f]{40}$/i.test(expectedRef)) { sendJson(response, 400, { schema: 'aicc.v4.error.v1', error: 'INVALID_EXPECTED_REF' }); return; }
      try {
        const head = await readGitHubProjectHead(project, { client, now });
        const comparison = compareProjectionFreshness(project, head, expectedRef, expectedRepository);
        sendJson(response, 200, { schema: 'aicc.v4.freshness.v1', projectId: project.id, repository: project.repository, status: comparison.status, reason: comparison.reason, expectedRef, currentRef: head.mainSha, checkedAt: head.checkedAt });
      } catch (error) { sendJson(response, 502, { schema: 'aicc.v4.error.v1', error: error.code ?? 'GITHUB_HEAD_UNAVAILABLE', detail: error.message }); }
      return;
    }

    const match = url.pathname.match(/^\/api\/projects\/([a-z0-9-]+)$/);
    if (match) {
      const project = getProjectLocator(registry, match[1]);
      if (!project) {
        sendJson(response, 404, { schema: 'aicc.v4.error.v1', error: 'PROJECT_NOT_REGISTERED' });
        return;
      }
      try {
        const facts = await readGitHubProjectFacts(project, { client, now });
        sendJson(response, 200, facts);
      } catch (error) {
        sendJson(response, 502, { schema: 'aicc.v4.error.v1', error: error.code ?? 'GITHUB_FACTS_UNAVAILABLE', detail: error.message });
      }
      return;
    }
    if (await sendStatic(response, url.pathname)) return;
    sendJson(response, 404, { schema: 'aicc.v4.error.v1', error: 'NOT_FOUND' });
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.AICC_V4_PORT ?? 1421);
  const server = await createV4Server();
  server.listen(port, '127.0.0.1', () => console.log(`AICC V4 read-only service listening on 127.0.0.1:${port}`));
}
