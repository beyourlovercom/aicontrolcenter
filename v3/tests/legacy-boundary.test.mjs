import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {dirname,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const v3Root=dirname(dirname(fileURLToPath(import.meta.url)));

function files(dir){
  return readdirSync(dir).flatMap(name=>{
    const path=join(dir,name);
    if(name==='tests')return [];
    return statSync(path).isDirectory()?files(path):[path];
  });
}

test('V3 source has no legacy runtime or application imports',()=>{
  for(const file of files(v3Root)){
    const text=readFileSync(file,'utf8');
    assert.doesNotMatch(text,/\.aicc-v2/ ,relative(v3Root,file));
    assert.doesNotMatch(text,/from\s+['"]\.\.\/src\//,relative(v3Root,file));
    assert.doesNotMatch(text,/1422/,relative(v3Root,file));
  }
});
