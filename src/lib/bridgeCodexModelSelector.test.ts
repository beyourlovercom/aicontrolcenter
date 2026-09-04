import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const root=process.cwd();
const content=readFileSync(join(root,'web-adapter/chrome-extension-current/content.js'),'utf8');
const registry=readFileSync(join(root,'web-adapter/chrome-extension-current/bridge-action-registry.js'),'utf8');
const worker=readFileSync(join(root,'web-adapter/chrome-extension-current/service-worker.js'),'utf8');
const core=readFileSync(join(root,'src/lib/bridgeCore.ts'),'utf8');
const server=readFileSync(join(root,'vite.config.ts'),'utf8');
const catalog=readFileSync(join(root,'src/lib/codexModelCatalog.ts'),'utf8');
const dom=readFileSync(join(root,'web-adapter/chatgpt-dom.js'),'utf8');

const labels=['剪贴板发送到 Codex 执行','发送到 Codex 并执行','插入 Codex 结果','发送到 AICC','执行下一步'];
assert.equal((registry.match(/actionKey:/g)??[]).length,6);
let prior=-1;for(const label of labels){const index=registry.indexOf(label);assert.ok(index>prior);prior=index;}
assert.match(content,/运行结果<\/h2><button[^>]+data-aicc-codex-profile-trigger/);
assert.match(content,/data-aicc-codex-profile-popover[^>]+role="menu" hidden/);
assert.match(content,/const BRIDGE_CODEX_PROFILE_KEY = 'BridgeCodexProfile'/);
assert.match(content,/model: profile\.model, reasoning_effort: profile\.reasoning_effort, updated_at:/);
assert.match(content,/panelStorage\(\)\?\.set\?\.\(\{ \[BRIDGE_CODEX_PROFILE_KEY\]: bridgeCodexProfile \}\)/);
assert.match(content,/panelStorage\(\)\?\.get\?\.\(\[BRIDGE_CODEX_PROFILE_KEY\]/);
assert.match(content,/panelStorage\(\)\?\.remove\?\.\(BRIDGE_CODEX_PROFILE_KEY\)/);
assert.match(content,/sourceType: 'GPT_BLOCK', codexProfile: bridgeCodexProfile/);
assert.match(content,/sourceType: 'CLIPBOARD_DIRECT', ownerDirectExecution: true, codexProfile: bridgeCodexProfile/);
assert.match(content.match(/async function sendInstruction\(\)[\s\S]*?(?=\n  async function executeCurrentWithCodex)/)?.[0]??'',/codexProfile/);
assert.match(worker,/model: message\.codexProfile\?\.model, reasoning: message\.codexProfile\?\.reasoning_effort/);
assert.match(worker,/JSON\.stringify\(\{ payload: text,[\s\S]*model: message\.codexProfile\?\.model,[\s\S]*reasoning: message\.codexProfile\?\.reasoning_effort/,'HTTP inbox body carries the selected canonical metadata');
assert.match(server,/readCodexModelCapabilitiesAsync\(\),readCodexDefaultsAsync\(\)/);
assert.match(catalog,/model\?\?defaults\.model/);
assert.match(core,/item\.model=started\.resolvedModel;item\.reasoning_effort=started\.reasoningLevel;item\.model_source=metadata\?\.model\?'OWNER_OVERRIDE':'CODEX_DEFAULT'/);
assert.match(core,/model:item\.model,reasoning_effort:item\.reasoning_effort,model_source:item\.model_source/);
assert.match(dom,/item\?\.report\?\.model \|\| item\?\.model/);
assert.match(content,/function runProfileLabel\(projection\)[\s\S]*if \(!projection\.model\) return ''/,'run profile is hidden without run-bound model evidence');
assert.match(content,/const model = modelCapability\(projection\.model\)\?\.displayName \|\| projection\.model/,'run profile renders the frozen runtime model rather than the current selector');
assert.match(content,/renderOptionalRuntimeField\(section, SELECTORS\.runtimeRunProfile, idle \? '' : runProfileLabel\(runtimeProjection\)\)/);

console.log('M8.2.1.6 Bridge Codex model selector matrix passed');
