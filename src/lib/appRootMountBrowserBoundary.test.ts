import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {svelte} from '@sveltejs/vite-plugin-svelte';

const root=new URL('../../',import.meta.url).pathname;
const server=await createServer({root,configFile:false,plugins:[svelte()],server:{middlewareMode:true},appType:'custom'});
try{
  const globalState=await server.transformRequest('/src/lib/globalStateReadModel.ts');
  assert.ok(globalState,'Global State read model transforms for the browser');
  assert.doesNotMatch(globalState.code,/__vite-browser-external:node:/,'browser projection module must not import Node built-ins');
  const app=await server.transformRequest('/src/App.svelte');
  assert.ok(app,'App entry module transforms for the browser');
  console.log('AICC App root browser module boundary passed');
}finally{
  await server.close();
}
