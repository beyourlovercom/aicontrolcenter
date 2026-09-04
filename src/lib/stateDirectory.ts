import {mkdtempSync,rmSync} from 'node:fs';
import {homedir,tmpdir} from 'node:os';
import {join} from 'node:path';

export const AICC_STATE_DIR_ENV='AICC_STATE_DIR';

const testStateDir=(()=>{
  if(process.env[AICC_STATE_DIR_ENV]||!process.argv[1]?.endsWith('.test.ts'))return undefined;
  const directory=mkdtempSync(join(tmpdir(),'aicc-test-state-'));
  process.once('exit',()=>rmSync(directory,{recursive:true,force:true}));
  return directory;
})();

export function resolveAiccStateDir(environment:NodeJS.ProcessEnv=process.env,home=homedir()):string{
  const configured=environment[AICC_STATE_DIR_ENV]?.trim();
  return configured||(environment===process.env?testStateDir:undefined)||join(home,'.aicc-v2');
}
