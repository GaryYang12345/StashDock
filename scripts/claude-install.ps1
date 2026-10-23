# Installs the locally built StashDock packages on this computer, for the
# user's own testing (run by claude-runner.ps1 tasks install-info,
# install-desktop and install-plugin).
#
#   info     where Desktop and the ChatGPT/Codex plugin are installed (read only)
#   desktop  close StashDock Desktop, run the newest built NSIS installer
#            silently, then start the installed app through the Windows shell
#   plugin   replace the installed plugin's files with the newest built package
#            (stopping only that plugin's own processes first)
param([Parameter(Mandatory)][ValidateSet('info', 'desktop', 'plugin')][string]$Target)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }

function Installed-Plugins {
  $cache = Join-Path $codexHome 'plugins\cache'
  if (-not (Test-Path $cache)) { return @() }
  Get-ChildItem -Path $cache -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $plugin = Join-Path $_.FullName 'stashdock'
    if (Test-Path $plugin) { Get-ChildItem -Path $plugin -Directory | Where-Object { Test-Path (Join-Path $_.FullName '.codex-plugin\plugin.json') } }
  }
}
function Installed-Desktop {
  $keys = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
  foreach ($entry in Get-ItemProperty $keys -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq 'StashDock' }) {
    $location = if ($entry.InstallLocation) { $entry.InstallLocation.Trim('"') } elseif ($entry.UninstallString) { Split-Path -Parent ($entry.UninstallString.Trim('"')) } else { $null }
    if ($location -and (Test-Path (Join-Path $location 'stashdock.exe'))) { return (Join-Path $location 'stashdock.exe') }
  }
  $fallback = Join-Path $env:LOCALAPPDATA 'StashDock\stashdock.exe'
  if (Test-Path $fallback) { return $fallback }
  return $null
}
function Version-Of([string]$path) { if ($path -and (Test-Path $path)) { (Get-Item $path).VersionInfo.ProductVersion } }

switch ($Target) {
  'info' {
    $exe = Installed-Desktop
    "Desktop installed: $exe (version $(Version-Of $exe))"
    "Running StashDock processes:"
    Get-Process stashdock, stashdock-preview, stashdock-storage, node -ErrorAction SilentlyContinue |
      Where-Object { $_.Path -and ($_.ProcessName -ne 'node' -or $_.Path -like '*stashdock*') } |
      ForEach-Object { "  $($_.ProcessName) $($_.Id) $($_.Path)" }
    "Installed plugins under $codexHome\plugins\cache:"
    foreach ($plugin in Installed-Plugins) {
      $manifest = Get-Content -Raw (Join-Path $plugin.FullName '.codex-plugin\plugin.json') | ConvertFrom-Json
      "  $($plugin.FullName) (version $($manifest.version))"
    }
    $config = Join-Path $codexHome 'config.toml'
    if (Test-Path $config) {
      # Only StashDock and marketplace entries; nothing else from the host's settings.
      "StashDock entries in config.toml:"
      $section = ''
      foreach ($line in Get-Content $config) {
        if ($line -match '^\s*\[(.+)\]\s*$') { $section = $Matches[1] }
        if ($section -match 'stashdock|marketplace') { "  $line" }
      }
    }
    "Built packages:"
    Get-ChildItem (Join-Path $root 'src-tauri\target\release\bundle\nsis') -Filter 'StashDock_*_x64-setup.exe' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime | Select-Object -Last 1 | ForEach-Object { "  $($_.FullName) $($_.LastWriteTime)" }
    Get-ChildItem (Join-Path $root 'output\releases') -Directory -Filter 'stashdock-plugin-*-win32-x64' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime | Select-Object -Last 1 | ForEach-Object { "  $($_.FullName) $($_.LastWriteTime)" }
  }
  'desktop' {
    $setup = Get-ChildItem (Join-Path $root 'src-tauri\target\release\bundle\nsis') -Filter 'StashDock_*_x64-setup.exe' | Sort-Object LastWriteTime | Select-Object -Last 1
    if (-not $setup) { throw 'No built installer. Run the desktop-build task first.' }
    # Close Desktop (installed, release or development build), not the plugin's
    # own helpers, which live under the host's plugin folder.
    Get-Process stashdock, stashdock-preview, stashdock-storage -ErrorAction SilentlyContinue |
      Where-Object { $_.Path -and $_.Path -notlike "$codexHome*" } |
      ForEach-Object { "Stopping $($_.ProcessName) $($_.Id) $($_.Path)"; Stop-Process -Id $_.Id -Force }
    Start-Sleep -Seconds 1
    "Installing $($setup.FullName)"
    $process = Start-Process -FilePath $setup.FullName -ArgumentList '/S' -Wait -PassThru
    if ($process.ExitCode -ne 0) { throw "Installer exited with $($process.ExitCode)." }
    $exe = Installed-Desktop
    if (-not $exe) { throw 'The installed app was not found.' }
    "Installed $exe (version $(Version-Of $exe))"
    # Hand the launch to the Windows shell, so the app's lifetime is not tied to this runner.
    Start-Process -FilePath explorer.exe -ArgumentList "`"$exe`""
    "Started through the Windows shell."
  }
  'plugin' {
    $package = Get-ChildItem (Join-Path $root 'output\releases') -Directory -Filter 'stashdock-plugin-*-win32-x64' | Sort-Object LastWriteTime | Select-Object -Last 1
    if (-not $package) { throw 'No built plugin package. Run the plugin-package task first.' }
    $source = Join-Path $package.FullName 'plugins\stashdock'
    $version = (Get-Content -Raw (Join-Path $source '.codex-plugin\plugin.json') | ConvertFrom-Json).version
    # Not $target: PowerShell names are case-insensitive, and $Target is the validated parameter.
    $installs = @(Installed-Plugins)
    if (-not $installs.Count) { throw "StashDock is not installed in $codexHome. Install it once from $($package.FullName) in ChatGPT." }
    foreach ($install in $installs) {
      Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path -like "$($install.FullName)*" } |
        ForEach-Object { "Stopping $($_.ProcessName) $($_.Id) $($_.Path)"; Stop-Process -Id $_.Id -Force }
      Start-Sleep -Seconds 1
      "Replacing $($install.FullName) with $version"
      & robocopy.exe $source $install.FullName /MIR /R:2 /W:1 /NJH /NJS /NP /NFL /NDL | Out-Null
      if ($LASTEXITCODE -ge 8) { throw "Copy failed (robocopy $LASTEXITCODE)." }
      $global:LASTEXITCODE = 0
      $now = (Get-Content -Raw (Join-Path $install.FullName '.codex-plugin\plugin.json') | ConvertFrom-Json).version
      "  now version $now"
    }
    "Restart ChatGPT (or start a new conversation) so it starts the new plugin."
  }
}
