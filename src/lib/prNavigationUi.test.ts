import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const navigation=readFileSync(new URL('../components/PrNavigation.svelte',import.meta.url),'utf8');
const currentContext=readFileSync(new URL('../components/CurrentContextLocator.svelte',import.meta.url),'utf8');
const evidence=readFileSync(new URL('../components/entity/PrEvidencePanel.svelte',import.meta.url),'utf8');

const filters=['ALL','IN_PROGRESS','BLOCKED','COMPLETE','UNMAPPED'];
assert.deepEqual([...navigation.matchAll(/\{id:'([A-Z_]+)',label:'[^']+'\}/g)].map(match=>match[1]),filters,'PR navigation exposes lifecycle and mapping filters in order');
assert.match(navigation,/\.pr-filters\{display:flex/,'PR filters use one horizontal flex row');
assert.match(navigation,/filterPrLayer2Records\(records,filter\)/,'browser filtering uses the Layer 2 projection');
const row=navigation.match(/<button class="pr-row"[\s\S]*?<\/button>/)?.[0]??'';
assert.ok(row,'compact PR row exists');
for(const required of ['record.prNumber','record.record.title','record.lifecycleStatus','record.mappingStatus'])assert.match(row,new RegExp(required.replace('.', '\\.')),'PR row renders Layer 2 lifecycle/mapping data only');
assert.doesNotMatch(row,/record\.progress|% complete|pr-progress/,'PR row renders neither percentage nor progress bar');
assert.match(navigation,/pr-status\.in-progress/,'in-progress has a semantic yellow status style');
assert.match(navigation,/pr-status\.blocked/,'blocked has a semantic red status style');
assert.match(navigation,/pr-status\.complete/,'complete has a semantic green status style');
assert.match(navigation,/pr-mapping/,'unmapped renders as separate neutral metadata');
assert.match(navigation,/\{id:'ALL',label:'全部'\}/,'all filter has its Chinese presentation label');
assert.match(navigation,/\{id:'UNMAPPED',label:'未绑定'\}/,'unmapped filter has its Chinese presentation label');
assert.match(row,/record\.mappingStatus==='MAPPED'\?'已绑定':'未绑定'/,'mapped and unmapped use Chinese presentation labels');
assert.doesNotMatch(row,/>MAPPED<|>UNMAPPED</,'raw mapping enums are not rendered in normal PR navigation');
assert.match(evidence,/bindingStatus=context\.parentWorkPackageId\?'已绑定':'未绑定'/,'PR detail derives Owner binding labels from existing mapping identity');
assert.match(evidence,/绑定状态[\s\S]*?\{bindingStatus\}/,'PR detail renders the Chinese binding label');
assert.doesNotMatch(navigation,/(?:fetch|localStorage|XMLHttpRequest|navigator\.sendBeacon)/,'sidebar selection and filtering have no source side effects');

assert.match(app,/async function refreshPrNavigationSnapshot\(\)[\s\S]*?method:'POST'/,'only explicit PR refresh performs a POST');
const selection=app.match(/function selectPrNavigationRecord\(id:string\)\{([\s\S]*?)\}\n  async function navigateGlobalEntity/)?.[1]??'';
assert.doesNotMatch(selection,/(?:refresh|fetch|request\()/,'PR selection does not refresh lifecycle status');
assert.match(app,/import PrNavigation from '\.\/components\/PrNavigation\.svelte';/,'App mounts the dedicated left PR navigation component');
assert.match(app,/GlobalPrWorkspace records=\{prLayer2\.records\} selectedId=\{selectedPrNavigationId\} onSelect=\{selectPrCenterRecord\}/,'PR root workspace uses the canonical PR selection');
assert.match(app,/data-testid="pr-detail"/,'selected PR detail remains available');
assert.match(currentContext,/workspace==='PR'\?'刷新PR':'更新 Roadmap'/,'PR refresh remains explicit and isolated from Roadmap refresh');
console.log('PR lifecycle status UI source contract passed');
