import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {canonicalFilesystemPath,sameCanonicalPath} from './canonicalPathIdentity.ts';

const dir=mkdtempSync(join(tmpdir(),'aicc-canonical-path-'));
try{
  const repository=join(dir,'Repository');mkdirSync(repository);
  const alias=join(dir,'repo-alias');symlinkSync(repository,alias);
  const sibling=join(dir,'Sibling');mkdirSync(sibling);
  assert.equal(sameCanonicalPath(repository,alias),true,'filesystem aliases resolve to one identity');
  assert.equal(sameCanonicalPath(repository,sibling),false,'distinct directories remain distinct');
  assert.equal(sameCanonicalPath(repository,join(dir,'missing')),false,'missing path fails closed');
  assert.equal(canonicalFilesystemPath(alias),canonicalFilesystemPath(repository));
}finally{rmSync(dir,{recursive:true,force:true})}

const read=(file:string)=>readFileSync(join(process.cwd(),file),'utf8');
const serverFiles=['src/lib/projectRegistryAuthority.ts','src/lib/controlService.ts','src/lib/fastExecution.ts','src/lib/runtimeManager.ts','src/lib/bridgeCore.ts','src/lib/localServiceRecovery.ts'];
for(const file of serverFiles)assert.match(read(file),/sameCanonicalPath/ ,`${file} delegates filesystem identity`);
const forbidden:[string,RegExp][]=[
  ['src/lib/controlService.ts',/cwd===REPOSITORY_ROOT|repositoryRoot\s*!==\s*repo\.repository/],
  ['src/lib/fastExecution.ts',/authorization\.repositoryRoot\s*!==\s*repo\.repository|lease\.repository\s*!==\s*repo\.repository/],
  ['src/lib/runtimeManager.ts',/expectedRepository\s*!==\s*repo\.repository|storedAuth\.repositoryRoot\s*===\s*repo\.repository/],
  ['src/lib/bridgeCore.ts',/authorization\.repositoryRoot\s*===\s*readRepository\(\)\.repository/],
  ['src/lib/projectRegistryAuthority.ts',/sameRepositoryRoot|realpathSync/],
  ['src/lib/projectEntityScope.ts',/repositoryPath===project\.repositoryPath/],
  ['src/lib/projectContext.ts',/gitRoot===value\.repositoryPath|repositoryPath===repository/],
  ['src/lib/context/authorizationResolver.ts',/repositoryRoot\s*!==\s*repo\.repository/],
];
for(const [file,pattern] of forbidden)assert.doesNotMatch(read(file),pattern,`${file} contains no raw path identity comparison`);
for(const file of ['src/lib/projectEntityScope.ts','src/lib/projectContext.ts','src/lib/context/authorizationResolver.ts'])assert.doesNotMatch(read(file),/canonicalPathIdentity|node:fs/,`${file} remains browser-safe and path is not browser authority`);
const tauri=read('src-tauri/src/lib.rs');
assert.match(tauri,/fn same_canonical_path\(/,'Tauri defines native canonical path identity helper');
assert.doesNotMatch(tauri,/input\s*!=\s*Path::new\(CANONICAL_PATH\)/,'Tauri does not compare configured path strings directly');
console.log('canonical path identity audit matrix passed');
