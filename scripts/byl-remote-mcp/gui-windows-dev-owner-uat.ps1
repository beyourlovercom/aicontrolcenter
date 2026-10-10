$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
$mutex=New-Object System.Threading.Mutex($false,'Local\BeYourLoverGuiOwnerCanary')
if(-not $mutex.WaitOne(0)){throw 'GUI_CANARY_BUSY'}
try{
 $marker='beyourlover-gui-owner-'+[Guid]::NewGuid().ToString('N')
 $profile=Join-Path $env:TEMP $marker
 $chrome='C:\Program Files\Google\Chrome\Application\chrome.exe'
 if(!(Test-Path $chrome)){throw 'CHROME_BINARY_MISSING'}
 Start-Process -FilePath $chrome -ArgumentList @("--user-data-dir=$profile",'--force-renderer-accessibility','--no-first-run','--no-default-browser-check','--new-window','https://dev.beyourlover.com/cart/')
 $window=$null
 for($i=0;$i -lt 50;$i++){
  Start-Sleep -Milliseconds 250
  $processes=@(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object {$_.CommandLine -like "*$marker*"})
  $ids=@($processes|Select-Object -ExpandProperty ProcessId)
  $windows=[System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
  $matches=@($windows|Where-Object {$ids -contains $_.Current.ProcessId})
  if($matches.Count -eq 1){$window=$matches[0];break}
 }
 if($null -eq $window){throw 'WINDOW_NOT_UNIQUE'}
 $editCondition=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Edit)
 $address=$null
 for($i=0;$i -lt 50;$i++){
  $edits=@($window.FindAll([System.Windows.Automation.TreeScope]::Descendants,$editCondition) | Where-Object {
    try{$v=$_.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value; $v -match '^(https://)?dev\.beyourlover\.com/cart/?$'}catch{$false}
  })
  if($edits.Count -eq 1){$address=$edits[0];break}
  Start-Sleep -Milliseconds 200
 }
 if($null -eq $address){throw 'ADDRESS_BAR_NOT_READY'}
 function Read-Address{return $address.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value}
 if((Read-Address) -notmatch '^(https://)?dev\.beyourlover\.com/cart/?$'){throw 'SOURCE_URL_NOT_VERIFIED'}
 $linkCondition=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Hyperlink)
 $link=$null
 for($i=0;$i -lt 40;$i++){
  $links=@($window.FindAll([System.Windows.Automation.TreeScope]::Descendants,$linkCondition)|Where-Object {$_.Current.Name -eq 'BeYourLover home'})
  if($links.Count -eq 1){$link=$links[0];break}
  Start-Sleep -Milliseconds 200
 }
 if($null -eq $link){throw 'HOME_LINK_NOT_UNIQUE'}
 if((Read-Address) -notmatch '^(https://)?dev\.beyourlover\.com/cart/?$'){throw 'SOURCE_CHANGED_BEFORE_CLICK'}
 $link.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
 for($i=0;$i -lt 50;$i++){
  Start-Sleep -Milliseconds 200
  try{
   if((Read-Address) -match '^(https://)?dev\.beyourlover\.com/?$'){
    Write-Output ('WINDOWS_GUI_NAVIGATION_PASS pid='+$window.Current.ProcessId+' verified=true')
    exit 0
   }
  }catch{}
 }
 throw 'POST_CLICK_RESULT_UNKNOWN'
}finally{
 $mutex.ReleaseMutex()
 $mutex.Dispose()
}
