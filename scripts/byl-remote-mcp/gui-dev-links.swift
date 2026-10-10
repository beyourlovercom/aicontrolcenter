import Cocoa
import ApplicationServices
guard CommandLine.arguments.count==2,let pid=Int32(CommandLine.arguments[1]) else{exit(2)}
let app=AXUIElementCreateApplication(pid)
func get(_ e:AXUIElement,_ k:String)->CFTypeRef?{var v:CFTypeRef?;return AXUIElementCopyAttributeValue(e,k as CFString,&v) == .success ? v:nil}
func str(_ e:AXUIElement,_ k:String)->String{get(e,k) as? String ?? ""}
guard let windows=get(app,kAXWindowsAttribute) as? [AXUIElement] else{exit(3)}
var links=[[String:String]](),seen=0
func scan(_ e:AXUIElement,_ depth:Int){
 if depth>14 || seen>1600 || links.count>65{return}
 seen+=1
 let role=str(e,kAXRoleAttribute)
 if role=="AXLink" {links.append(["title":String(str(e,kAXTitleAttribute).prefix(70)),"value":String(str(e,kAXValueAttribute).prefix(150)),"url":String(str(e,"AXURL").prefix(150))])}
 if let children=get(e,kAXChildrenAttribute) as? [AXUIElement]{for c in children.prefix(150){scan(c,depth+1)}}
}
for w in windows.prefix(2){scan(w,0)}
let d=try JSONSerialization.data(withJSONObject:links,options:[.sortedKeys])
print(String(data:d,encoding:.utf8)!)
