import Cocoa
import ApplicationServices
let args=CommandLine.arguments
guard args.count==3, let pid=Int32(args[1]), args[2].hasPrefix("BYL GUI ") else {exit(2)}
let ax=AXUIElementCreateApplication(pid)
var windowsValue:CFTypeRef?
guard AXUIElementCopyAttributeValue(ax,kAXWindowsAttribute as CFString,&windowsValue) == .success,
 let windows=windowsValue as? [AXUIElement] else {print("NO_WINDOWS");exit(3)}
var selected:AXUIElement?
for w in windows {var v:CFTypeRef?;if AXUIElementCopyAttributeValue(w,kAXTitleAttribute as CFString,&v) == .success,let t=v as? String,t.contains(args[2]) {if selected != nil {print("AMBIGUOUS");exit(4)};selected=w}}
guard let w=selected else {print("TARGET_NOT_FOUND");exit(5)}
let app=NSRunningApplication(processIdentifier:pid)
_ = app?.activate(options:[.activateIgnoringOtherApps])
let raise=AXUIElementPerformAction(w,kAXRaiseAction as CFString)
usleep(250000)
let front=NSWorkspace.shared.frontmostApplication?.processIdentifier ?? 0
print("FRONTMOST_PID=\(front) TARGET_PID=\(pid) RAISE=\(raise.rawValue)")
guard front==pid else {exit(6)}
var pos:CFTypeRef?,size:CFTypeRef?
_ = AXUIElementCopyAttributeValue(w,kAXPositionAttribute as CFString,&pos)
_ = AXUIElementCopyAttributeValue(w,kAXSizeAttribute as CFString,&size)
var point=CGPoint.zero,sz=CGSize.zero
if let p=pos as! AXValue? {AXValueGetValue(p,.cgPoint,&point)}
if let v=size as! AXValue? {AXValueGetValue(v,.cgSize,&sz)}
print("WINDOW_FRAME=\(point.x),\(point.y),\(sz.width),\(sz.height)")
