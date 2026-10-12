import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('./mcp-endpoint.mjs',import.meta.url),'utf8');
// Static guard: never load the actual MCP server or credentials during CI.
test('007windows is present in MCP endpoint routing',()=>{
  assert.match(source,/'007windows':'http:\/\/100\.99\.21\.57:8791'/);
  for(const [id,address] of [
    ['us-macmini','http://127.0.0.1:8791'],
    ['china-mac','http://100.102.15.40:8791'],
    ['windows','http://100.87.29.56:8791']
  ]) assert(source.includes(`'${id}':'${address}'`));
});
test('four-device ID schema is used for every remote tool',()=>{
  const marker="z.enum(['us-macmini','china-mac','windows','007windows'])";
  assert.equal(source.split(marker).length-1,3);
  assert.equal(source.includes("z.enum(['us-macmini','china-mac','windows'])"),false);
});
