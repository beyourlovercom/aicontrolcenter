import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { authorizationBlocker, authorizationState, persistAuthorization, reauthorizeAuthorization, readAuthorization, readRoadmap, readRepository, readWorkPackage, syncLocalMain } from './src/lib/controlService';
import { codexInfo, readRuntime, startRuntime, stopRuntime } from './src/lib/runtimeManager';
import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [svelte(), localControlPlugin()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] }
  }
});

function json(res: ServerResponse, body: unknown, status = 200) { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); }
function localControlPlugin(): Plugin { return { name: 'aicc-local-control', configureServer(server) {
  server.middlewares.use('/api/health', (_req: IncomingMessage, res: ServerResponse) => json(res, { ok: true, service: 'aicc-local-control' }));
  server.middlewares.use('/api/roadmap', (_req: IncomingMessage, res: ServerResponse) => { try { json(res, { source: 'docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md', content: readRoadmap() }); } catch { json(res, { error: 'ROADMAP_ERROR' }, 500); } });
  server.middlewares.use('/api/repository', (_req: IncomingMessage, res: ServerResponse) => { try { json(res, readRepository()); } catch { json(res, { error: 'REPOSITORY_ERROR' }, 500); } });
  server.middlewares.use('/api/authorization', (req: IncomingMessage, res: ServerResponse) => {
    if (req.headers.origin && req.headers.origin !== 'http://127.0.0.1:1420' && req.headers.origin !== 'http://localhost:1420') return json(res, { error: 'ORIGIN_REJECTED' }, 403);
    if (req.method === 'GET') { try { const repo = readRepository(); const id = new URL(req.url ?? '/', 'http://localhost').searchParams.get('workPackageId') ?? ''; json(res, { ...authorizationState(id, repo), record: readAuthorization() }); } catch { json(res, { error: 'AUTHORIZATION_ERROR' }, 500); } return; }
    if (req.method !== 'POST' || req.headers['content-type']?.split(';')[0] !== 'application/json') return json(res, { error: 'JSON_REQUIRED' }, 415);
    let body = ''; req.on('data', (chunk) => body += chunk); req.on('end', () => { try { const payload = JSON.parse(body) as { workPackageId?: string; selectedEntityId?: string; confirmed?: boolean }; if (payload.confirmed !== true || typeof payload.workPackageId !== 'string' || payload.selectedEntityId !== payload.workPackageId) return json(res, { error: 'AUTHORIZATION_TARGET_MISMATCH' }, 400); const repo = readRepository(); readWorkPackage(payload.workPackageId); const blocker = authorizationBlocker(payload.workPackageId, repo, true); const existing = readAuthorization(); if (blocker && blocker !== 'AUTHORIZATION_CONFLICT') return json(res, { error: blocker }, 409); const result = existing ? reauthorizeAuthorization(payload.workPackageId, repo) : { record: persistAuthorization(payload.workPackageId, repo), superseded: false }; if (result.record.workPackageId !== payload.workPackageId || result.record.headShaAtAuthorization !== repo.head || result.record.branch !== repo.branch || result.record.repositoryRoot !== repo.repository) return json(res, { error: 'AUTHORIZATION_PERSISTENCE_INTEGRITY_FAILED' }, 500); json(res, { status: result.superseded ? 'REAUTHORIZED' : 'AUTHORIZED', record: result.record, superseded: result.superseded }); } catch (error) { json(res, { error: error instanceof Error ? error.message : 'AUTHORIZATION_ERROR' }, 409); } }); return;
  });
  server.middlewares.use('/api/repository/sync-main', (req: IncomingMessage, res: ServerResponse) => {
    if (req.headers.origin && req.headers.origin !== 'http://127.0.0.1:1420' && req.headers.origin !== 'http://localhost:1420') return json(res, { error: 'ORIGIN_REJECTED' }, 403);
    if (req.method !== 'POST' || req.headers['content-type']?.split(';')[0] !== 'application/json') return json(res, { error: 'JSON_REQUIRED' }, 415);
    let body = ''; req.on('data', (chunk) => body += chunk); req.on('end', () => { try { const payload = JSON.parse(body); if (Object.keys(payload).length) return json(res, { error: 'FIXED_INPUT_ONLY' }, 400); json(res, { status: syncLocalMain() }); } catch (error) { json(res, { error: error instanceof Error ? error.message : 'SYNC_ERROR' }, 409); } }); return;
  });
  server.middlewares.use('/api/codex/runtime', (_req: IncomingMessage, res: ServerResponse) => json(res, { info: codexInfo(), runtime: readRuntime() }));
  server.middlewares.use('/api/codex/start', (req: IncomingMessage, res: ServerResponse) => { if (req.headers.origin && req.headers.origin !== 'http://127.0.0.1:1420' && req.headers.origin !== 'http://localhost:1420') return json(res,{error:'ORIGIN_REJECTED'},403); if(req.method!=='POST'||req.headers['content-type']?.split(';')[0]!=='application/json')return json(res,{error:'JSON_REQUIRED'},415);let body='';req.on('data',c=>body+=c);req.on('end',()=>{try{const p=JSON.parse(body) as {workPackageId?:string};if(Object.keys(p).some(k=>k!=='workPackageId')||typeof p.workPackageId!=='string')return json(res,{error:'FIXED_INPUT_ONLY'},400);json(res,startRuntime(p.workPackageId));}catch(e){json(res,{error:e instanceof Error?e.message:'RUNTIME_ERROR'},409);}});});
  server.middlewares.use('/api/codex/stop', (req: IncomingMessage, res: ServerResponse) => { if(req.method!=='POST'||req.headers['content-type']?.split(';')[0]!=='application/json')return json(res,{error:'JSON_REQUIRED'},415);let body='';req.on('data',c=>body+=c);req.on('end',()=>{try{if(Object.keys(JSON.parse(body)).length)return json(res,{error:'FIXED_INPUT_ONLY'},400);stopRuntime();json(res,{status:'STOPPING'});}catch(e){json(res,{error:e instanceof Error?e.message:'STOP_ERROR'},409);}});});
  server.middlewares.use('/api/work-packages', (req: IncomingMessage, res: ServerResponse) => { const id = decodeURIComponent((req.url ?? '').split('/').filter(Boolean)[0] ?? ''); try { json(res, readWorkPackage(id)); } catch (error) { json(res, { error: error instanceof Error ? error.message : 'WP_ERROR' }, 404); } });
} }; }
