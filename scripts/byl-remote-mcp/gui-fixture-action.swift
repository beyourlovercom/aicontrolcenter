import Cocoa
import ApplicationServices
let args=CommandLine.arguments
guard args.count==3,let pid=Int32(args[1]),["click","type"].contains(args[2]) else {exit(2)}
guard AXIsProcessTrusted() else {print("AX_NOT_TRUSTED");exit(3)}
let app=AXUIElementCreateApplication(pid)
func get(_ e:AXUIElement,_ k:String)->CFTypeRef?{var v:CFTypeRef?;return AXUIElementCopyAttributeValue(e,k as CFString,&v) == .success ? v:nil}
func str(_ e:AXUIElement,_ k:String)->String{get(e,k) as? String ?? ""}
guard let ws=get(app,kAXWindowsAttribute) as? [AXUIElement] else {exit(4)}
let expected=args[2]=="click" ? "BYL GUI TEST READY" : "BYL GUI CLICK PASS"
let targets=ws.filter {str($0,kAXTitleAttribute).hasPrefix(expected)}
guard targets.count==1 else {print("TARGET_NOT_UNIQUE");exit(5)}
let win=targets[0]
var address=[String](),fields=[AXUIElement](),buttons=[AXUIElement]()
func scan(_ e:AXUIElement,_ depth:Int){
 if depth>16{return}
 let role=str(e,kAXRoleAttribute),title=str(e,kAXTitleAttribute)
 if role=="AXTextField" && (title.contains("地址") || title.lowercased().contains("address")){address.append(str(e,kAXValueAttribute))}
 if role=="AXTextField" && title=="GUI text test"{fields.append(e)}
 if role=="AXButton" && title=="Click test only"{buttons.append(e)}
 if let ch=get(e,kAXChildrenAttribute) as? [AXUIElement]{for x in ch.prefix(160){scan(x,depth+1)}}
}
scan(win,0)
guard address.count==1 && address[0]=="/tmp/byl-gui-owner-uat-20261010.html" else{print("URL_NOT_BOUND");exit(6)}
let candidates=args[2]=="click" ? buttons:fields
guard candidates.count==1 else{print("ELEMENT_NOT_UNIQUE");exit(7)}
let e=candidates[0]
guard let pv=get(e,kAXPositionAttribute) as! AXValue?,let sv=get(e,kAXSizeAttribute) as! AXValue? else{exit(8)}
var point=CGPoint.zero,size=CGSize.zero
AXValueGetValue(pv,.cgPoint,&point);AXValueGetValue(sv,.cgSize,&size)
guard size.width>=80 && size.height>=20 else{exit(9)}
_ = NSRunningApplication(processIdentifier:pid)?.activate()
_ = AXUIElementPerformAction(win,kAXRaiseAction as CFString)
usleep(120000)
guard NSWorkspace.shared.frontmostApplication?.processIdentifier==pid else{print("FOCUS_LOST");exit(10)}
let xy=CGPoint(x:point.x+size.width/2,y:point.y+size.height/2)
guard let d=CGEvent(mouseEventSource:nil,mouseType:.leftMouseDown,mouseCursorPosition:xy,mouseButton:.left),
 let u=CGEvent(mouseEventSource:nil,mouseType:.leftMouseUp,mouseCursorPosition:xy,mouseButton:.left) else{exit(11)}
d.post(tap:.cghidEventTap);usleep(60000);u.post(tap:.cghidEventTap)
if args[2]=="type"{
 usleep(70000)
 for ch in "UATPASS".utf16{
  guard NSWorkspace.shared.frontmostApplication?.processIdentifier==pid else{print("FOCUS_LOST");exit(12)}
  for down in [true,false]{
   guard let key=CGEvent(keyboardEventSource:nil,virtualKey:0,keyDown:down) else{exit(13)}
   var unit=ch
   key.keyboardSetUnicodeString(stringLength:1,unicodeString:&unit)
   key.post(tap:.cghidEventTap)
  }
 }
}
usleep(350000)
let after=str(win,kAXTitleAttribute)
let expectedAfter=args[2]=="click" ? "BYL GUI CLICK PASS" : "BYL GUI TYPE UATPASS"
print("ACTION="+args[2]+" BEFORE="+expected+" AFTER="+after)
guard after.hasPrefix(expectedAfter) else{print("RESULT_NOT_VERIFIED");exit(14)}
print("GUI_FIXTURE_ACTION_PASS")
