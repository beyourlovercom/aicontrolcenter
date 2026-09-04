import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../components/GlobalWpWorkspace.svelte',import.meta.url),'utf8');

assert.match(app,/let selectedEntity:SelectedEntityRef=/,'WP_SELECTION_AUTHORITY = selectedEntity');
assert.match(app,/function enterWorkPackageRoot\(\)\{[\s\S]*?activeGlobalTab='WP'[\s\S]*?selectedEntity=\{type:'milestone',id:roadmapNodes\[0\]\?\.id\?\?'M1'\}/,'TOP_WP_CLICK_ENTERS_ROOT = PASS');
assert.match(app,/if\(tab==='WP'\)\{enterWorkPackageRoot\(\);return\}/,'TOP_WP_CLICK_CLEARS_CONCRETE_WP = PASS');
assert.match(app,/if\(\['PR','TASK','WP'\]\.includes\(activeGlobalTab\)\)globalWorkspace=true/,'WP_ROOT_RESTORES_AS_ROOT = PASS');
assert.match(app,/selectedId=\{selectedEntity\.type==='work_package'\?selectedEntity\.id:null\}/,'CONCRETE_WP_SELECTION_CANONICAL = PASS');
assert.doesNotMatch(workspace,/let selected:any=null/,'DUPLICATE_WP_SELECTION_STATE = NO');
assert.match(workspace,/export let selectedId:string\|null=null/,'WP_ROW_SELECTION_IS_APP_PROJECTED = PASS');

console.log('WP canonical selection and root contract passed');
