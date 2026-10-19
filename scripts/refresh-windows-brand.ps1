$ErrorActionPreference = "Stop"
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$executable = Join-Path $projectRoot "stashdock.exe"
$sourceIcon = Join-Path $projectRoot "src-tauri\icons\icon.ico"
if (-not (Test-Path -LiteralPath $executable) -or -not (Test-Path -LiteralPath $sourceIcon)) {
  throw "Build StashDock and generate brand icons first."
}

# Give Shell a content-addressed icon location rather than reusing the cached
# executable's previous default icon. No global icon cache deletion or Explorer
# restart. Only existing StashDock shortcuts targeting this checkout are changed.
$hasher = [System.Security.Cryptography.SHA256]::Create()
$iconStream = [System.IO.File]::OpenRead($sourceIcon)
try { $digest = [BitConverter]::ToString($hasher.ComputeHash($iconStream)).Replace("-", "").Substring(0, 12).ToLowerInvariant() }
finally { $iconStream.Dispose(); $hasher.Dispose() }
$iconPath = Join-Path $projectRoot "assets\generated\stashdock-brand-$digest.ico"
if (-not (Test-Path -LiteralPath $iconPath)) { Copy-Item -LiteralPath $sourceIcon -Destination $iconPath }
$backupDir = Join-Path $projectRoot ("artifacts\shortcut-backups\" + (Get-Date -Format "yyyyMMdd-HHmmss"))
$shell = New-Object -ComObject WScript.Shell
$folders = @(
  [Environment]::GetFolderPath("Desktop"),
  [Environment]::GetFolderPath("CommonDesktopDirectory"),
  (Join-Path ([Environment]::GetFolderPath("StartMenu")) "Programs"),
  (Join-Path ([Environment]::GetFolderPath("CommonStartMenu")) "Programs"),
  (Join-Path $env:APPDATA "Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar")
)
$updated = @()
foreach ($folder in $folders) {
  $path = Join-Path $folder "StashDock.lnk"
  if (-not (Test-Path -LiteralPath $path)) { continue }
  $shortcut = $shell.CreateShortcut($path)
  if (-not [StringComparer]::OrdinalIgnoreCase.Equals($shortcut.TargetPath, $executable)) { continue }
  if ($shortcut.IconLocation -eq "$iconPath,0") { continue }
  New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
  Copy-Item -LiteralPath $path -Destination (Join-Path $backupDir ("shortcut-" + $updated.Count + ".lnk"))
  $shortcut.IconLocation = "$iconPath,0"
  $shortcut.Save()
  $updated += $path
}

# File-specific Shell metadata notification, not UI automation or a system-wide
# association/cache reset. Wait for these few item notifications to be delivered.
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class StashDockBrandNotification {
  [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
  private static extern void SHChangeNotify(uint eventId, uint flags, string item1, IntPtr item2);
  public static void Updated(string path) { SHChangeNotify(0x00002000, 0x00001005, path, IntPtr.Zero); }
}
'@
foreach ($path in @($iconPath, $executable) + $updated) { [StashDockBrandNotification]::Updated($path) }
[pscustomobject]@{ Icon = $iconPath; UpdatedShortcuts = $updated; BackupDirectory = if ($updated.Count) { $backupDir } else { $null } } | ConvertTo-Json
