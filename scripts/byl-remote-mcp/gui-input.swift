import Cocoa
import ApplicationServices
let args=CommandLine.arguments
guard args.count >= 2 else { fputs("USAGE: status|move|click|type\n",stderr); exit(2) }
guard AXIsProcessTrusted() else { fputs("AX_NOT_TRUSTED\n",stderr); exit(3) }
func front() -> String { NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? "" }
let before=front()
guard before == "com.google.Chrome" else { fputs("FOCUS_DENIED:\(before)\n",stderr); exit(4) }
func emit(_ type:CGEventType,_ pt:CGPoint) {
 guard let event=CGEvent(mouseEventSource:nil,mouseType:type,mouseCursorPosition:pt,mouseButton:.left) else {exit(5)}
 event.post(tap:.cghidEventTap)
}
if args[1]=="status" { print("CHROME_FRONTMOST=true"); exit(0) }
if args[1]=="type" {
 guard args.count == 3, args[2].count <= 120, !args[2].contains("\n"), !args[2].contains("\r") else {exit(11)}
 for unit in args[2].utf16 {
  guard front()==before else { fputs("FOCUS_CHANGED\n",stderr);exit(12) }
  for down in [true,false] {
   guard let e=CGEvent(keyboardEventSource:nil,virtualKey:0,keyDown:down) else {exit(13)}
   var value=unit
   e.keyboardSetUnicodeString(stringLength:1,unicodeString:&value)
   e.post(tap:.cghidEventTap)
  }
 }
 print("KEY_EVENTS_SENT_NOT_VERIFIED")
 exit(0)
}
guard args.count == 4,let x=Double(args[2]),let y=Double(args[3]),x>=0,y>=0 else { exit(6) }
let frame=CGDisplayBounds(CGMainDisplayID())
guard x<frame.width,y<frame.height else { fputs("BOUNDS_DENIED\n",stderr);exit(7) }
let pt=CGPoint(x:x,y:y)
guard front()==before else {exit(8)}
if args[1]=="move" {emit(.mouseMoved,pt)}
else if args[1]=="click" {emit(.leftMouseDown,pt); usleep(90000);guard front()==before else {exit(9)};emit(.leftMouseUp,pt)}
else { fputs("ACTION_DENIED\n",stderr);exit(10) }
print("EVENT_SENT_NOT_VERIFIED")
