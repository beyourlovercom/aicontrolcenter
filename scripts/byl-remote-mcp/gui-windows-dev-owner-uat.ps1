$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
$profile=Join-Path $env:TEMP 'beyourlover-gui-owner-live-20261010'
$chrome='C:\Program Files\Google\Chrome\Application\chrome.exe'
if(!(Test-Path $chrome)){throw 'CHROME_BINARY_MISSING'}
$existing=@(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object {$_.CommandLine -like '*beyourlover-gui-owner-live-20261010*'})
if($existing.Count -eq 0){Start-Process -FilePath $chrome -ArgumentList @("--user-data-dir=$profile",'--force-renderer-accessibility','--no-first-run','--no-default-browser-check','--new-window','https://dev.beyourlover.com/cart/')}
$window=$null
for($i=0;$i -lt 40;$i++){
  Start-Sleep -Milliseconds 300
  $p=@(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object {$_.CommandLine -like '*beyourlover-gui-owner-live-20261010*'})
  $ids=@($p|Select-Object -ExpandProperty ProcessId)
  $ws=[System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
  $matches=@($ws|Where-Object {$ids -contains $_.Current.ProcessId})
  if($matches.Count -eq 1){$window=$matches[0];break}
}
if($null -eq $window){throw 'WINDOW_NOT_UNIQUE'}
$editCond=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Edit)
$addressEdits=@($window.FindAll([System.Windows.Automation.TreeScope]::Descendants,$editCond)|Where-Object {try{$v=$_.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value;$v -match '^(https://)?dev\.beyourlover\.com/cart/?$'}catch{$false}})
if($addressEdits.Count -ne 1){throw 'ADDRESS_BAR_NOT_UNIQUE'}
$address=$addressEdits[0]
function Read-Address {return $address.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value}
for($i=0;$i -lt 30;$i++){if((Read-Address) -match '^(https://)?dev\.beyourlover\.com/cart/?$'){break};Start-Sleep -Milliseconds 250}
if((Read-Address) -notmatch '^(https://)?dev\.beyourlover\.com/cart/?$'){throw 'SOURCE_URL_NOT_VERIFIED'}
$cond=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Hyperlink)
$link=$null
for($i=0;$i -lt 30;$i++){
  $links=@($window.FindAll([System.Windows.Automation.TreeScope]::Descendants,$cond)|Where-Object {$_.Current.Name -eq 'BeYourLover home'})
  if($links.Count -eq 1){$link=$links[0];break}
  Start-Sleep -Milliseconds 250
}
if($null -eq $link){throw 'HOME_LINK_NOT_UNIQUE'}
$link.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
for($i=0;$i -lt 40;$i++){
  Start-Sleep -Milliseconds 250
  if((Read-Address) -match '^(https://)?dev\.beyourlover\.com/?$'){
    Write-Output ('WINDOWS_GUI_NAVIGATION_PASS pid='+$window.Current.ProcessId+' verified=true')
    exit 0
  }
}
throw 'NAVIGATION_OUTCOME_NOT_VERIFIED'