import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const host = process.env.TAURI_DEV_HOST;
const backendPort = process.env.AICC_V5_BACKEND_PORT || '1420';

export default defineConfig({
  plugins: [svelte()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    proxy: { '/api/chatgpt': { target: `http://127.0.0.1:${backendPort}`, changeOrigin: false } },
    watch: { ignored: ['**/src-tauri/**'] }
  }
});
