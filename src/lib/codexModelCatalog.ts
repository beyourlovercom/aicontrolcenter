import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';

export type CodexModelCapability={model:string;displayName:string;reasoningLevels:string[];defaultReasoning:string};
export function readCodexModelCapabilities():CodexModelCapability[]{
  try{
    const raw=JSON.parse(readFileSync(join(process.env.CODEX_HOME??join(homedir(),'.codex'),'models_cache.json'),'utf8')) as {models?:Array<{slug?:string;display_name?:string;visibility?:string;default_reasoning_level?:string;supported_reasoning_levels?:Array<{effort?:string}>}>};
    return (raw.models??[]).filter(item=>item.slug&&item.visibility!=='hidden').map(item=>({model:item.slug!,displayName:item.display_name??item.slug!,reasoningLevels:(item.supported_reasoning_levels??[]).map(level=>level.effort).filter((level):level is string=>Boolean(level)),defaultReasoning:item.default_reasoning_level??item.supported_reasoning_levels?.[0]?.effort??'low'}));
  }catch{return []}
}
export function readCodexDefaults(){try{const config=readFileSync(join(process.env.CODEX_HOME??join(homedir(),'.codex'),'config.toml'),'utf8');return {model:config.match(/^model\s*=\s*"([^"]+)"/m)?.[1],reasoning:config.match(/^model_reasoning_effort\s*=\s*"([^"]+)"/m)?.[1]}}catch{return {model:undefined,reasoning:undefined}}}
export async function readCodexModelCapabilitiesAsync():Promise<CodexModelCapability[]>{try{const raw=JSON.parse(await readFile(join(process.env.CODEX_HOME??join(homedir(),'.codex'),'models_cache.json'),'utf8')) as {models?:Array<{slug?:string;display_name?:string;visibility?:string;default_reasoning_level?:string;supported_reasoning_levels?:Array<{effort?:string}>}>};return (raw.models??[]).filter(item=>item.slug&&item.visibility!=='hidden').map(item=>({model:item.slug!,displayName:item.display_name??item.slug!,reasoningLevels:(item.supported_reasoning_levels??[]).map(level=>level.effort).filter((level):level is string=>Boolean(level)),defaultReasoning:item.default_reasoning_level??item.supported_reasoning_levels?.[0]?.effort??'low'}))}catch{return[]}}
export async function readCodexDefaultsAsync(){try{const config=await readFile(join(process.env.CODEX_HOME??join(homedir(),'.codex'),'config.toml'),'utf8');return {model:config.match(/^model\s*=\s*"([^"]+)"/m)?.[1],reasoning:config.match(/^model_reasoning_effort\s*=\s*"([^"]+)"/m)?.[1]}}catch{return {model:undefined,reasoning:undefined}}}
export function resolveCodexModel(model?:string,reasoning?:string){const capabilities=readCodexModelCapabilities(),defaults=readCodexDefaults();const selected=capabilities.find(item=>item.model===(model??defaults.model))??(!model?capabilities[0]:undefined);if(!selected)throw new Error('MODEL_UNAVAILABLE');const resolvedReasoning=reasoning??defaults.reasoning??selected.defaultReasoning;if(!selected.reasoningLevels.includes(resolvedReasoning))throw new Error('REASONING_LEVEL_UNAVAILABLE');return {model:selected.model,reasoning:resolvedReasoning};}
