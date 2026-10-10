import {execFileSync} from 'node:child_process';
import {selectWindow} from './gui-window-select.mjs';
export function discover(){
 const raw=execFileSync('/usr/bin/swift',[new URL('./gui-ax-windows.swift',import.meta.url).pathname],{encoding:'utf8',timeout:20000});
 const result=JSON.parse(raw);
 return result.candidates.flatMap(c=>c.titles.map(title=>({pid:c.pid,title})));
}
export function findTarget(expectedTitle,expectedPid){
 return selectWindow(discover(),{expectedTitle,expectedPid});
}
if(process.argv[1]===new URL(import.meta.url).pathname)console.log(JSON.stringify({windows:discover()}));
