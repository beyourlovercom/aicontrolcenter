import Cocoa
import ApplicationServices
guard CommandLine.arguments.count==2, let pid=Int32(CommandLine.arguments[1]) else {exit(2)}
let app=AXUIElementCreateApplication(pid)
func target() -> AXUIElement? {
 var val:CFTypeRef?
 guard AXUIElementCopyAttributeValue(app,kAXWindowsAttribute as CFString,&val) == .success,let windows=val as? [AXUIElement] else{return nil}
 let matches=windows.filter { w in
  var t:CFTypeRef?
  return AXUIElementCopyAttributeValue(w,kAXTitleAttribute as CFString,&t) == .success && ((t as? String ?? "").hasPrefix("BYL GUI "))
 }
 return matches.count==1 ? matches[0] : nil
}
func title(_ w:AXUIElement) -> String {
 var t:CFTypeRef?
 _=AXUIElementCopyAttributeValue(w,kAXTitleAttribute as CFString,&t)
 return t as? String ?? ""
}
guard let w=target() else {print("FAIL_TARGET_NOT_UNIQUE");exit(3)}
let initial=title(w)
guard initial.contains("TEST READY") else {print("FAIL_PRECONDITION:"+initial);exit(4)}
_ = NSRunningApplication(processIdentifier:pid)?.activate()
_ = AXUIElementPerformAction(w,kAXRaiseAction as CFString)
usleep(150000)
guard NSWorkspace.shared.frontmostApplication?.processIdentifier==pid else {print("FAIL_FOCUS");exit(5)}
var p:CFTypeRef?,z:CFTypeRef?
guard AXUIElementCopyAttributeValue(w,kAXPositionAttribute as CFString,&p) == .success,
 AXUIElementCopyAttributeValue(w,kAXSizeAttribute as CFString,&z) == .success,
 let pv=p as! AXValue?,let zv=z as! AXValue? else {exit(6)}
var pos=CGPoint.zero,sz=CGSize.zero
AXValueGetValue(pv,.cgPoint,&pos);AXValueGetValue(zv,.cgSize,&sz)
guard sz.width>500 && sz.height>400 else {exit(7)}
let click=CGPoint(x:pos.x+170,y:pos.y+255)
guard let down=CGEvent(mouseEventSource:nil,mouseType:.leftMouseDown,mouseCursorPosition:click,mouseButton:.left),
 let up=CGEvent(mouseEventSource:nil,mouseType:.leftMouseUp,mouseCursorPosition:click,mouseButton:.left) else {exit(8)}
down.post(tap:.cghidEventTap);usleep(75000);up.post(tap:.cghidEventTap)
usleep(850000)
guard let after=target() else {print("FAIL_NO_WINDOW_AFTER");exit(9)}
let current=title(after)
print("BEFORE="+initial+" AFTER="+current+" CLICK="+String(Int(click.x))+","+String(Int(click.y)))
guard current.contains("CLICK PASS") else {print("EVENT_SENT_BUT_NOT_VERIFIED");exit(10)}
print("SAFE_GUI_CLICK_E2E_PASS")
