import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readRoadmap, readRepository, readWorkPackage } from './src/lib/controlService';
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
  server.middlewares.use('/api/work-packages', (req: IncomingMessage, res: ServerResponse) => { const id = decodeURIComponent((req.url ?? '').split('/').filter(Boolean)[0] ?? ''); try { json(res, readWorkPackage(id)); } catch (error) { json(res, { error: error instanceof Error ? error.message : 'WP_ERROR' }, 404); } });
} }; }
