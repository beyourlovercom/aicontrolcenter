import type {ProviderDescriptor} from './executionProviderRegistry.ts';
export const DEFAULT_PROVIDER_DESCRIPTORS:ProviderDescriptor[]=[
  {provider_id:'codex',display_name:'Codex',capabilities:['implementation','remediation','review','analysis','read_only_audit'],status:'active',version:'1'},
  {provider_id:'REMOTE_CLAUDE',display_name:'US Claude',capabilities:['implementation','analysis','read_only_audit'],status:'active',version:'1'},
  {provider_id:'opencode',display_name:'OpenCode',capabilities:['analysis','read_only_audit'],status:'disabled',version:'1'}
];
