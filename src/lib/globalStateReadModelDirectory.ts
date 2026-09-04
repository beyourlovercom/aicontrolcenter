import {join} from 'node:path';
import {resolveAiccStateDir} from './stateDirectory.ts';
import {GLOBAL_STATE_READ_MODEL_AUTHORITY,GLOBAL_STATE_READ_MODEL_FILE,GLOBAL_STATE_WRITE_AUTHORITY} from './globalStateReadModel.ts';

/** Server-only location metadata for the durable Global State read model. */
export function globalStateReadModelDirectory(stateDirectory=resolveAiccStateDir()){
  return Object.freeze({
    authority:GLOBAL_STATE_READ_MODEL_AUTHORITY,
    writeAuthority:GLOBAL_STATE_WRITE_AUTHORITY,
    stateDirectory,
    projectionPath:join(stateDirectory,GLOBAL_STATE_READ_MODEL_FILE)
  });
}
