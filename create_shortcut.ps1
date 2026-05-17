# Creates a desktop shortcut for NGO Accounting System
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$vbsPath   = Join-Path $scriptDir "NGO Accounting.vbs"
$shortcut  = Join-Path ([Environment]::GetFolderPath("Desktop")) "NGO Accounting.lnk"

$wsh  = New-Object -ComObject WScript.Shell
$link = $wsh.CreateShortcut($shortcut)
$link.TargetPath       = "wscript.exe"
$link.Arguments        = "`"$vbsPath`""
$link.WorkingDirectory = $scriptDir
$link.Description      = "NGO Accounting System"
# Use a green Python icon if available, else default
$pythonw = (Get-Command pythonw.exe -ErrorAction SilentlyContinue).Source
if ($pythonw) { $link.IconLocation = "$pythonw,0" }
$link.Save()

Write-Host "Shortcut created: $shortcut"
