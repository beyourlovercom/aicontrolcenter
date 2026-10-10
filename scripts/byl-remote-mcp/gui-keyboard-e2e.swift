import Cocoa
import ApplicationServices
guard CommandLine.arguments.count == 2,let pid=Int32(CommandLine.arguments[1]) else {exit(2)}
let ax=AXUIElementCreateApplication(pid)
func get(_ e:AXUIElement,_ k:String)->CFTypeRef?{var v:CFTypeRef?;return AXUIElementCopyAttributeValue(e,k as CFString,&v) == .success ? v:nil}
func str(_ e:AXUIElement,_ k:String)->String{get(e,k) as? String ?? ""}
guard let ws=get(ax,kAXWindowsAttribute) as? [AXUIElement] else {exit(3)}
let windows=ws.filter {str($0,kAXTitleAttribute).hasPrefix("BYL GUI CLICK PASS")}
guard windows.count==1 else {print("WINDOW_UNAVAILABLE");exit(4)}
let win=windows[0]
var fields=[AXUIElement]()
func scan(_ e:AXUIElement,_ depth:Int) {
 if depth>15{return}
 if str(e,kAXRoleAttribute)=="AXTextField" && str(e,kAXTitleAttribute)=="GUI text test"{fields.append(e)}
 if let children=get(e,kAXChildrenAttribute) as? [AXUIElement] {for c in children.prefix(150){scan(c,depth+1)}}
}
scan(win,0)
guard fields.count==1 else {print("FIELD_NOT_UNIQUE");exit(5)}
let field=fields[0]
var point=CGPoint.zero,size=CGSize.zero
guard let pv=get(field,kAXPositionAttribute) as! AXValue?,let zv=get(field,kAXSizeAttribute) as! AXValue? else {exit(6)}
AXValueGetValue(pv,.cgPoint,&point);AXValueGetValue(zv,.cgSize,&size)
guard size.width>80 && size.height>20 else {exit(7)}
_ = NSRunningApplication(processIdentifier:pid)?.activate()
_ = AXUIElementPerformAction(win,kAXRaiseAction as CFString)
usleep(100000)
guard NSWorkspace.shared.frontmostApplication?.processIdentifier==pid else {print("FOCUS_STOLEN_BEFORE");exit(8)}
let pt=CGPoint(x:point.x+size.width/2,y:point.y+size.height/2)
guard let d=CGEvent(mouseEventSource:nil,mouseType:.leftMouseDown,mouseCursorPosition:pt,mouseButton:.left),let u=CGEvent(mouseEventSource:nil,mouseType:.leftMouseUp,mouseCursorPosition:pt,mouseButton:.left) else {exit(9)}
d.post(tap:.cghidEventTap);usleep(40000);u.post(tap:.cghidEventTap)
usleep(50000)
for code in "UATPASS".utf16 {
 guard NSWorkspace.shared.frontmostApplication?.processIdentifier==pid else {print("FOCUS_STOLEN_DURING");exit(10)}
 for down in [true,false] {
  guard let e=CGEvent(keyboardEventSource:nil,virtualKey:0,keyDown:down) else {exit(11)}
  var unit=code;e.keyboardSetUnicodeString(stringLength:1,unicodeString:&unit);e.post(tap:.cghidEventTap)
 }
}
usleep(350000)
let after=str(win,kAXTitleAttribute)
print("AFTER="+after)
guard after.contains("BYL GUI TYPE UATPASS") else {print("TYPE_EVENT_NOT_VERIFIED");exit(12)}
print("GUI_KEYBOARD_E2E_PASS")
