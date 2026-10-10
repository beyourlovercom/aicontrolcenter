import Cocoa
import ApplicationServices
guard CommandLine.arguments.count==2,let pid=Int32(CommandLine.arguments[1]),pid>0 else{exit(2)}
let app=AXUIElementCreateApplication(pid)
func get(_ e:AXUIElement,_ k:String)->CFTypeRef?{var v:CFTypeRef?;return AXUIElementCopyAttributeValue(e,k as CFString,&v) == .success ? v:nil}
func str(_ e:AXUIElement,_ k:String)->String{get(e,kAXRoleAttribute) != nil ? (get(e,k) as? String ?? "") : ""}
func scan(_ e:AXUIElement,_ depth:Int,_ hits:inout [AXUIElement]){
 if depth>15 || hits.count>3{return}
 if str(e,kAXRoleAttribute)=="AXLink" && str(e,kAXTitleAttribute)=="BeYourLover home"{hits.append(e)}
 if let cs=get(e,kAXChildrenAttribute) as? [AXUIElement]{for c in cs.prefix(160){scan(c,depth+1,&hits)}}
}
func address(_ w:AXUIElement)->String{
 var urls=[String]()
 func walk(_ e:AXUIElement,_ depth:Int){
  if depth>15{return}
  let name=str(e,kAXTitleAttribute)
  if str(e,kAXRoleAttribute)=="AXTextField" && (name.contains("地址") || name.lowercased().contains("address")){urls.append(str(e,kAXValueAttribute))}
  if let cs=get(e,kAXChildrenAttribute) as? [AXUIElement]{for c in cs.prefix(160){walk(c,depth+1)}}
 }
 walk(w,0);return urls.count==1 ? urls[0]:""
}
func url(_ a:String)->URL?{URL(string:a.hasPrefix("https://") ? a:"https://"+a)}
guard let ws=get(app,kAXWindowsAttribute) as? [AXUIElement],ws.count==1,let w=ws.first else{print("WINDOW_MISMATCH");exit(3)}
guard let u=url(address(w)),u.scheme=="https",u.host=="dev.beyourlover.com",["/cart","/cart/"].contains(u.path) else{print("SOURCE_DENIED");exit(4)}
var links=[AXUIElement]();scan(w,0,&links)
guard links.count==1 else{print("LINK_NOT_UNIQUE");exit(5)}
_ = NSRunningApplication(processIdentifier:pid)?.activate()
_ = AXUIElementPerformAction(w,kAXRaiseAction as CFString)
usleep(180000)
guard NSWorkspace.shared.frontmostApplication?.processIdentifier==pid else{print("FOCUS_STOLEN");exit(6)}
guard AXUIElementPerformAction(links[0],kAXPressAction as CFString) == .success else{print("AX_PRESS_FAILED");exit(7)}
for _ in 0..<16{
 usleep(200000)
 guard NSWorkspace.shared.frontmostApplication?.processIdentifier==pid else{print("FOCUS_STOLEN_AFTER_PRESS");exit(8)}
 if let after=url(address(w)),after.host=="dev.beyourlover.com",["","/"].contains(after.path),after.query==nil,after.fragment==nil {print("DEV_HOME_NAVIGATION_PASS pid=\(pid) path=/");exit(0)}
}
print("NAVIGATION_NOT_VERIFIED");exit(9)
