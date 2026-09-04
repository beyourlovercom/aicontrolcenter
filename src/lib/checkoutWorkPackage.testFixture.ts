import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {WorkPackage} from './controlService.ts';

const ROOTS=['docs/10_Planning_Roadmap/WorkPackages','docs/60_Operations/work-packages'] as const;

export function readCheckoutWorkPackage(id:string,root=process.cwd()):WorkPackage{
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id))throw new Error('WP_INVALID_ID');
  const relativePath=ROOTS.map(base=>`${base}/${id}.md`).find(path=>existsSync(join(root,path)));
  if(!relativePath)throw new Error('WP_NOT_FOUND_IN_CHECKOUT');
  const text=readFileSync(join(root,relativePath),'utf8');
  const heading=text.match(/^#\s+(.+)$/m)?.[1]??id;
  const fields:Record<string,string>={};
  for(const line of text.split('\n')){
    const colon=line.match(/^(?:\*\*)?([^:*]+?)(?:\*\*)?:\s*(.+)$/);
    const equality=line.match(/^`?\s*([^=`:]+?)\s*(?:=|:)\s*([^`]+?)\s*`?\s*$/);
    const match=colon??equality;
    if(match)fields[match[1].trim().replace(/^`|`$/g,'')]=match[2].trim().replace(/^`|`$/g,'');
  }
  const sections:Record<string,string>={};let section='';
  for(const line of text.split('\n')){const match=line.match(/^##\s+(.+?)\s*$/);if(match){section=match[1].trim();sections[section]=''}else if(section)sections[section]+=`${sections[section]?'\n':''}${line}`}
  for(const key of Object.keys(sections))sections[key]=sections[key].trim();
  const pick=(...keys:string[])=>keys.map(key=>sections[key]??fields[key]).find(value=>value?.trim())?.trim()??'';
  const goal=pick('Goal','目标'),scope=pick('Scope','范围'),dependencies=pick('Dependencies','依赖'),acceptanceCriteria=pick('Acceptance Criteria','验收标准','Machine Acceptance','机器验收'),risks=pick('Risks','风险'),allowed=pick('Allowed','允许'),forbidden=pick('Forbidden','禁止');
  sections.Goal=goal;sections.Scope=scope;sections.Dependencies=dependencies;sections['Acceptance Criteria']=acceptanceCriteria;
  return {id,title:heading.replace(/^[^:：]+[:：]\s*/,''),source:relativePath,rawMarkdown:text,fields,sections,status:fields.Status??fields.status??'未提供',goal,scope,dependencies,acceptanceCriteria,risks,allowed,forbidden};
}
