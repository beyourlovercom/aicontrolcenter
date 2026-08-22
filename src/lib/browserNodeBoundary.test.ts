import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const files=[
  'src/components/GlobalWpWorkspace.svelte',
  'src/components/WpGeneratorPanel.svelte',
  'src/lib/wpGenerationAgent.ts',
  'src/lib/projectContextClient.ts'
];
for(const file of files){
  const source=readFileSync(join(process.cwd(),file),'utf8');
  assert.doesNotMatch(source,/createProjectRegistryAuthority/ ,`${file} must not instantiate server project authority`);
  assert.doesNotMatch(source,/from ['"][^'"]*projectRegistryAuthority(?:\.ts)?['"]/ ,`${file} must not import server project authority`);
  assert.doesNotMatch(source,/from ['"]node:/ ,`${file} must not import Node built-ins`);
}
const client=readFileSync(join(process.cwd(),'src/lib/projectContextClient.ts'),'utf8');
assert.match(client,/fetcher\('\/api\/project-context'/,'browser project context must come from local API');
const vite=readFileSync(join(process.cwd(),'vite.config.ts'),'utf8');
assert.match(vite,/server\.middlewares\.use\('\/api\/project-context'/,'server project-context transport must remain available');
console.log('Browser/Node project authority boundary matrix passed');
