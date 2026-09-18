import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const repoRoot=join(fileURLToPath(new URL('..',import.meta.url)));
const source=readFileSync(join(repoRoot,'browser-bridge/composer-text.js'),'utf8');
const sandbox={};
vm.createContext(sandbox);
vm.runInContext(source,sandbox);
const read=sandbox.__AICC_COMPOSER_PLAIN_TEXT__;

function text(value){return {nodeType:3,nodeValue:value,textContent:value,childNodes:[]};}
function el(tag,children=[],attrs={}){
  return {nodeType:1,tagName:tag.toUpperCase(),childNodes:children,textContent:children.map(c=>c.textContent??c.nodeValue??'').join(''),getAttribute:(name)=>attrs[name]??null};
}
function composerRoot(...children){return el('div',children);}

test('plain text node remains byte-for-byte exact',()=>{
  assert.equal(read(composerRoot(text('AICC_NEXT_STEP_V1\nexact  spaces'))),'AICC_NEXT_STEP_V1\nexact  spaces');
});

test('top-level ProseMirror paragraphs serialize with exact newlines',()=>{
  assert.equal(read(composerRoot(el('p',[text('line 1')]),el('p',[text('line 2')]))),'line 1\nline 2');
});

test('explicit br serializes to newline while trailing placeholder br is ignored',()=>{
  const trailing=el('br',[],{class:'ProseMirror-trailingBreak'});
  assert.equal(read(composerRoot(el('p',[text('alpha'),el('br'),text('beta')]),el('p',[trailing]))),'alpha\nbeta\n');
});

test('div and pre blocks preserve unicode punctuation and spacing',()=>{
  const value='中文：AICC — exact\nCODE_CHANGE -> CLAUDE_CODE';
  const node=composerRoot(el('div',[text('中文：AICC — exact')]),el('pre',[text('CODE_CHANGE -> CLAUDE_CODE')]));
  assert.equal(read(node),value);
});

test('ProseMirror NBSP artifacts normalize back to ordinary spaces',()=>{
  assert.equal(read(composerRoot(el('p',[text('a\u00a0b')]))),'a b');
  assert.equal(read(composerRoot(el('p',[text('\u00a0\u00a0"runtime": {')]))),'  "runtime": {');
});

test('serializer does not trim, collapse, or normalize character drift',()=>{
  assert.equal(read(composerRoot(el('p',[text(' x  y ')]))),' x  y ');
  assert.notEqual(read(composerRoot(el('p',[text('x y')]))),'x  y');
  assert.notEqual(read(composerRoot(el('p',[text('AICC–NEXT')]))),'AICC-NEXT');
});
