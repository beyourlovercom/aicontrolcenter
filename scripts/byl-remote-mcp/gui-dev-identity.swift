import Cocoa
import ApplicationServices
guard CommandLine.arguments.count==2,let pid=Int32(CommandLine.arguments[1]) else {exit(2)}
let ax=AXUIElementCreateApplication(pid)
func get(_ e:AXUIElement,_ k:String)->CFTypeRef?{var v:CFTypeRef?;return AXUIElementCopyAttributeValue(e,k as CFString,&v) == .success ? v:nil}
func str(_ e:AXUIElement,_ k:String)->String{get(e,k) as? String ?? ""}
guard let windows=get(ax,kAXWindowsAttribute) as? [AXUIElement],windows.count==1 else{print("WINDOW_COUNT_DENIED");exit(3)}
let win=windows[0]
var urls=[String]()
func scan(_ e:AXUIElement,_ depth:Int){
 if depth>14{return}
 let title=str(e,kAXTitleAttribute)
 if str(e,kAXRoleAttribute)=="AXTextField" && (title.contains("地址") || title.lowercased().contains("address")){urls.append(str(e,kAXValueAttribute))}
 if let children=get(e,kAXChildrenAttribute) as? [AXUIElement]{for child in children.prefix(160){scan(child,depth+1)}}
}
scan(win,0)
guard urls.count==1 else{print("ADDRESS_BAR_NOT_UNIQUE");exit(4)}
let value=urls[0].hasPrefix("https://") ? urls[0] : "https://"+urls[0]
guard let url=URL(string:value),url.scheme=="https",url.host=="dev.beyourlover.com",["/cart","/cart/"].contains(url.path) else {let inspected=URL(string:value);print("DEV_HOST_OR_PATH_DENIED host=\(inspected?.host ?? "unparseable") path=\(inspected?.path ?? "unparseable")");exit(5)}
print("DEV_GUI_READONLY_IDENTITY_PASS pid=\(pid) host=\(url.host!) path=\(url.path)")
