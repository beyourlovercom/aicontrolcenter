import Cocoa
import ApplicationServices
guard CommandLine.arguments.count==2,let pid=Int32(CommandLine.arguments[1]) else {exit(2)}
let app=AXUIElementCreateApplication(pid)
func get(_ e:AXUIElement,_ k:String)->CFTypeRef? {var v:CFTypeRef?;return AXUIElementCopyAttributeValue(e,k as CFString,&v) == .success ? v:nil}
func str(_ e:AXUIElement,_ k:String)->String {get(e,k) as? String ?? ""}
guard let windows=get(app,kAXWindowsAttribute) as? [AXUIElement] else {exit(3)}
for win in windows {
 guard str(win,kAXTitleAttribute).hasPrefix("BYL GUI ") else {continue}
 func scan(_ e:AXUIElement,_ depth:Int){
  if depth>14{return}
  let role=str(e,kAXRoleAttribute)
  if role=="AXTextField" {
   let title=str(e,kAXTitleAttribute)
   if title.contains("地址") || title.lowercased().contains("address") {print("ADDRESS_BAR="+str(e,kAXValueAttribute))}
  }
  if let ch=get(e,kAXChildrenAttribute) as? [AXUIElement] {for x in ch.prefix(120){scan(x,depth+1)}}
 }
 scan(win,0)
}
