import type {ProcessAdapter} from './runtimeManager.ts';
import {createCodexExecutionProvider} from './codexExecutionProvider.ts';
import {ExecutionProviderRegistry} from './executionProviderRegistry.ts';
import {createOpenCodeExecutionProvider} from './openCodeExecutionProvider.ts';
export function getRuntimeExecutionProvider(adapter:ProcessAdapter,available:boolean){
  const registry=new ExecutionProviderRegistry('codex');
  const provider=createCodexExecutionProvider({available,spawnProcess:adapter.spawn});
  registry.register(provider,{provider_id:'codex',display_name:'Codex',capabilities:['implementation','remediation','read_only_audit','review','analysis'],status:'active',version:'1'});
  registry.register(createOpenCodeExecutionProvider(),{provider_id:'opencode',display_name:'OpenCode',capabilities:['analysis','read_only_audit'],status:'disabled',version:'1'});
  return {registry,provider:registry.selectDefault()!};
}
