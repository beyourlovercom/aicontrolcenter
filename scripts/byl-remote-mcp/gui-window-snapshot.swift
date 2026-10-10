import Cocoa
import ApplicationServices
guard CommandLine.arguments.count==2,let pid=Int32(CommandLine.arguments[1]),pid>0 else{exit(2)}
let app=AXUIElementCreateApplication(pid)
func get(_ e:AXUIElement,_ key:String)->CFTypeRef?{var v:CFTypeRef?;return AXUIElementCopyAttributeValue(e,key as CFString,&v) == .success ? v:nil}
func str(_ e:AXUIElement,_ key:String)->String{get(e,key) as? String ?? ""}
guard let windows=get(app,kAXWindowsAttribute) as? [AXUIElement] else{print("{\"windows\":[]}");exit(0)}
var records=[[String:String]]()
for window in windows.prefix(8){
 var urls=[String](),visited=0
 func scan(_ e:AXUIElement,_ depth:Int){
  if depth>15 || visited>1500{return}
  visited += 1
  let title=str(e,kAXTitleAttribute),role=str(e,kAXRoleAttribute)
  if role=="AXTextField" && (title.contains("地址") || title.lowercased().contains("address")){urls.append(str(e,kAXValueAttribute))}
  if let children=get(e,kAXChildrenAttribute) as? [AXUIElement]{for child in children.prefix(200){scan(child,depth+1)}}
 }
 scan(window,0)
 records.append(["title":str(window,kAXTitleAttribute),"url":urls.count==1 ? urls[0] : "","addressBarCount":String(urls.count)])
}
let data=try JSONSerialization.data(withJSONObject:["pid":Int(pid),"windows":records],options:[.sortedKeys])
print(String(data:data,encoding:.utf8)!)
