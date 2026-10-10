import Cocoa
import ApplicationServices
let apps=NSRunningApplication.runningApplications(withBundleIdentifier:"com.google.Chrome")
var candidates=[[String:Any]]()
for app in apps {
 let ax=AXUIElementCreateApplication(app.processIdentifier)
 var value:CFTypeRef?
 let e=AXUIElementCopyAttributeValue(ax,kAXWindowsAttribute as CFString,&value)
 let windows=(value as? [AXUIElement]) ?? []
 var titles=[String]()
 for w in windows {var title:CFTypeRef?;if AXUIElementCopyAttributeValue(w,kAXTitleAttribute as CFString,&title) == .success {titles.append(title as? String ?? "")}}
 candidates.append(["pid":Int(app.processIdentifier),"axError":Int(e.rawValue),"windowCount":windows.count,"titles":titles])
}
let result:[String:Any]=["instanceCount":apps.count,"candidates":candidates]
let data=try! JSONSerialization.data(withJSONObject:result,options:[.sortedKeys])
print(String(data:data,encoding:.utf8)!)
