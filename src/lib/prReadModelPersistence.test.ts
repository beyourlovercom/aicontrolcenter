import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {deserializePrNavigationSnapshot} from './prNavigationSnapshot.ts';

const root=process.cwd();
const target=join(root,'docs/10_Planning_Roadmap/03_AICC_PR_READ_MODEL.json');
const service=readFileSync(join(root,'src/lib/controlService.ts'),'utf8');
const app=readFileSync(join(root,'src/App.svelte'),'utf8');
const vite=readFileSync(join(root,'vite.config.ts'),'utf8');

assert.equal(target,join(root,'docs/10_Planning_Roadmap/03_AICC_PR_READ_MODEL.json'),'the persistent PR read model has one canonical local path');
assert.match(service,/export const PR_LOCAL_READ_MODEL_FILE=join\(REPOSITORY_ROOT,'docs\/10_Planning_Roadmap\/03_AICC_PR_READ_MODEL\.json'\)/);
assert.doesNotMatch(service,/pr-navigation-snapshot\.json/,'production has no old PR navigation snapshot path');
assert.match(service,/readOrRebuildPersistedPrNavigationSnapshot\(\):Promise<PrNavigationSnapshot>\{return readPersistedPrNavigationSnapshot\(\)\?\?refreshPrNavigationSnapshotAsync\(\);\}/,'missing local models rebuild from GitHub facts');
assert.match(service,/readPullRequests\(\):PullRequestRecord\[\]\{const snapshot=readPersistedPrNavigationSnapshot\(\);return snapshot\?snapshot\.records\.map\(record=>toPullRequestRecordLike\(record\) as PullRequestRecord\):\[\];\}/,'the local model always yields an array rather than a legacy fallback');
assert.match(vite,/readSnapshot:readOrRebuildPersistedPrNavigationSnapshot/,'the production PR route performs first-run recovery');
assert.doesNotMatch(app,/aicc\.pr-navigation\.snapshot\.v1/,'the browser no longer persists a competing PR snapshot');
assert.match(app,/projectPrLayer2\(prLayer2\.model,pullRequests,String\(accepted\.snapshot_version\)\)/,'UI projects PR facts through Layer 2 rather than reading the file directly');
assert.doesNotMatch(app,/location\.reload|window\.location\.reload/,'PR refresh has no browser reload recovery path');
assert.ok(existsSync(target),'the current local read model is materialized by the real refresh path');
const snapshot=deserializePrNavigationSnapshot(JSON.parse(readFileSync(target,'utf8')));
assert.ok(snapshot,'persisted local PR read model conforms to the stable schema');
assert.ok(Array.isArray(snapshot.records),'PR collection is always defined as an array');
assert.ok(snapshot.records.length>0,'a nonempty canonical GitHub response cannot silently become an empty local projection');
console.log('PR local read model persistence contract passed');
