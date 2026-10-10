import {execFileSync} from 'node:child_process';
import {selectWindow} from './gui-window-select.mjs';
export function discover(){
 const raw=execFileSync('/usr/bin/swift',[new URL('./gui-ax-windows.swift',import.meta.url).pathname],{encoding:'utf8',timeout:20000});
 const result=JSON.parse(raw);
 return result.candidates.flatMap(c=>c.titles.map(title=>({pid:c.pid,title})));
}
export function findTarget(expectedTitle,expectedPid){
 const selected=selectWindow(discover(),{expectedTitle,expectedPid});
 if(!selected.ok)return selected;
 try {
  const raw=execFileSync('/usr/bin/swift',[new URL('./gui-target-url.swift',import.meta.url).pathname,String(selected.pid)],{encoding:'utf8',timeout:20000});
  const lines=raw.split(/\r?\n/).filter(s=>s.startsWith('ADDRESS_BAR='));
  if(lines.length!==1)return {...selected,url:''};
  return {...selected,url:lines[0].slice('ADDRESS_BAR='.length)};
 }catch{return {...selected,url:''};}
}
if(process.argv[1]===new URL(import.meta.url).pathname)console.log(JSON.stringify({windows:discover()}));
