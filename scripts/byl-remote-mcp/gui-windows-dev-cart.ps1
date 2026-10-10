param([Parameter(Mandatory=$true)][string]$ProfileMarker,[ValidateSet('Inspect','NavigateHome')][string]$Action='Inspect')
$ErrorActionPreference='Stop'
if($ProfileMarker -notmatch '^beyourlover-gui-[a-zA-Z0-9_-]{5,80}$'){throw 'ISOLATED_PROFILE_REQUIRED'}
Add-Type -AssemblyName UIAutomationClient
$processes=@(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object {
 $_.CommandLine -like "*--user-data-dir=*$ProfileMarker*" -and $_.CommandLine -like '*--force-renderer-accessibility*'
})
if($processes.Count -lt 1){throw 'CHROME_PROFILE_NOT_FOUND'}
$ids=@($processes | Select-Object -ExpandProperty ProcessId)
$windows=[System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
$matches=@($windows | Where-Object { $ids -contains $_.Current.ProcessId })
if($matches.Count -ne 1){throw 'CHROME_WINDOW_NOT_UNIQUE'}
$w=$matches[0]
$editCondition=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Edit)
function Read-Address {
 $allEdits=$w.FindAll([System.Windows.Automation.TreeScope]::Descendants,$editCondition)
 $edits=@($allEdits | Where-Object { $_.Current.Name -match 'Address|地址|Search' })
 if($edits.Count -ne 1){throw 'ADDRESS_NOT_UNIQUE'}
 return $edits[0].GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value
}
$before=Read-Address
if($before -notmatch '^(https://)?dev\.beyourlover\.com/cart/?$'){throw 'DEV_CART_SOURCE_DENIED'}
if($Action -eq 'Inspect'){Write-Output ('WINDOWS_DEV_CART_INSPECT_PASS pid='+$w.Current.ProcessId);exit 0}
$linkCondition=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Hyperlink)
$allLinks=$w.FindAll([System.Windows.Automation.TreeScope]::Descendants,$linkCondition)
$links=@($allLinks | Where-Object { $_.Current.Name -eq 'BeYourLover home' })
if($links.Count -ne 1){throw 'HOME_LINK_NOT_UNIQUE'}
$links[0].GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
$verified=$false
for($i=0;$i -lt 16;$i++){
 Start-Sleep -Milliseconds 200
 $after=Read-Address
 if($after -match '^(https://)?dev\.beyourlover\.com/?$'){ $verified=$true;break }
}
if(-not $verified){throw 'NAVIGATION_NOT_VERIFIED'}
Write-Output ('WINDOWS_DEV_HOME_NAVIGATION_PASS pid='+$w.Current.ProcessId)
