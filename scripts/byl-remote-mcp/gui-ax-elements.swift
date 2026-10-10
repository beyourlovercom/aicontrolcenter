import Cocoa
import ApplicationServices
guard CommandLine.arguments.count==2,let pid=Int32(CommandLine.arguments[1]) else {exit(2)}
let app=AXUIElementCreateApplication(pid)
var windows:CFTypeRef?
guard AXUIElementCopyAttributeValue(app,kAXWindowsAttribute as CFString,&windows) == .success,let arr=windows as? [AXUIElement] else {exit(3)}
func walk(_ element:AXUIElement,_ depth:Int) {
 if depth>16{return}
 var role:CFTypeRef?,title:CFTypeRef?,children:CFTypeRef?
 _=AXUIElementCopyAttributeValue(element,kAXRoleAttribute as CFString,&role)
 _=AXUIElementCopyAttributeValue(element,kAXTitleAttribute as CFString,&title)
 let r=(role as? String) ?? "",t=(title as? String) ?? ""
 if r=="AXButton" || r=="AXTextField" || t.contains("Click test") {
  var p:CFTypeRef?,z:CFTypeRef?;var point=CGPoint.zero,size=CGSize.zero
  if AXUIElementCopyAttributeValue(element,kAXPositionAttribute as CFString,&p) == .success,let v=p as! AXValue? {AXValueGetValue(v,.cgPoint,&point)}
  if AXUIElementCopyAttributeValue(element,kAXSizeAttribute as CFString,&z) == .success,let v=z as! AXValue? {AXValueGetValue(v,.cgSize,&size)}
  print("ELEMENT role=\(r) title=\(t) x=\(point.x) y=\(point.y) width=\(size.width) height=\(size.height)")
 }
 if AXUIElementCopyAttributeValue(element,kAXChildrenAttribute as CFString,&children) == .success,let cs=children as? [AXUIElement] {for c in cs.prefix(150){walk(c,depth+1)}}
}
for w in arr {var title:CFTypeRef?;_ = AXUIElementCopyAttributeValue(w,kAXTitleAttribute as CFString,&title);if (title as? String ?? "").contains("BYL GUI") {walk(w,0)}}
