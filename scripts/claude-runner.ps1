# Runs a fixed set of development tasks on this Windows computer for Claude,
# whose own shell is a Linux VM that cannot run PowerShell, MSVC or WebView2.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\claude-runner.ps1
#
# Claude writes output\claude-review\queue\<id>.task containing one task name
# from $Tasks below (nothing else is executed). The runner writes <id>.log and
# then <id>.done ({ task, exitCode, seconds }). Close this window to stop it.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$queue = Join-Path $root 'output\claude-review\queue'
New-Item -ItemType Directory -Force -Path $queue | Out-Null
$devPidFile = Join-Path $queue 'desktop-dev.pid'
$devLog = Join-Path $queue 'desktop-dev.log'
# The development WebView exposes its DevTools protocol on loopback only, so
# Claude can read console errors and take screenshots of the real window.
$debugPort = 9229

function Stop-Dev {
  if (Test-Path $devPidFile) {
    $devPid = Get-Content $devPidFile
    & taskkill.exe /T /F /PID $devPid 2>&1 | Out-String
    Remove-Item $devPidFile -Force
  } else { 'desktop:dev is not running.' }
  # The app, Vite and preview helpers started by that tree.
  Get-Process stashdock, stashdock-preview -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$root*" } | Stop-Process -Force -ErrorAction SilentlyContinue
}

$Tasks = [ordered]@{
  'test'          = { & powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-for-claude.ps1 -Steps test }
  'diagnose'      = { & powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-for-claude.ps1 -Steps diagnose }
  'probe-proxy'   = { & powershell -NoProfile -ExecutionPolicy Bypass -File scripts\probe-proxy.ps1 }
  'typecheck'     = { & cmd /c 'npx tsc -b 2>&1' }
  'node-tests'    = { & cmd /c 'node --test --test-reporter=tap tests/*.test.mjs 2>&1' }
  'desktop-test'  = { & cmd /c 'npm run desktop:test 2>&1' }
  'preview-helper'= { & cmd /c 'npm run preview:helper 2>&1' }
  'dev-start'     = {
    Stop-Dev | Out-Null
    $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=$debugPort"
    $process = Start-Process -FilePath cmd.exe -ArgumentList '/c', "npm run desktop:dev > `"$devLog`" 2>&1" -WorkingDirectory $root -WindowStyle Minimized -PassThru
    Remove-Item Env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
    Set-Content $devPidFile $process.Id
    "Started desktop:dev (pid $($process.Id)); log: $devLog"
  }
  'dev-stop'      = { Stop-Dev }
  'inspect'       = { & cmd /c "node scripts/inspect-webview.mjs --port $debugPort --out `"$queue`" 2>&1" }
  'inspect-reload'= { & cmd /c "node scripts/inspect-webview.mjs --port $debugPort --reload --out `"$queue`" 2>&1" }
  'git-status'    = { & cmd /c 'git status --short --branch 2>&1 && git log --oneline -5 2>&1' }
}

Write-Host "Claude runner watching $queue" -ForegroundColor Cyan
Write-Host ("Tasks: " + ($Tasks.Keys -join ', '))
while ($true) {
  foreach ($file in Get-ChildItem $queue -Filter '*.task' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime) {
    $id = $file.BaseName
    $name = (Get-Content $file.FullName -Raw).Trim()
    Remove-Item $file.FullName -Force
    if ($id -notmatch '^[\w-]{1,64}$') { continue }
    $log = Join-Path $queue "$id.log"
    $done = Join-Path $queue "$id.done"
    if (-not $Tasks.Contains($name)) {
      "Unknown task '$name'. Allowed: $($Tasks.Keys -join ', ')" | Set-Content $log
      @{ task = $name; exitCode = 2; seconds = 0 } | ConvertTo-Json | Set-Content $done
      continue
    }
    Write-Host ("{0} {1} ..." -f (Get-Date -Format 'HH:mm:ss'), $name)
    $timer = [Diagnostics.Stopwatch]::StartNew()
    $global:LASTEXITCODE = 0
    try { & $Tasks[$name] *>&1 | Out-File -FilePath $log -Encoding utf8; $code = $LASTEXITCODE }
    catch { $_ | Out-String | Add-Content $log; $code = 1 }
    $seconds = [math]::Round($timer.Elapsed.TotalSeconds, 1)
    @{ task = $name; exitCode = $code; seconds = $seconds } | ConvertTo-Json | Set-Content $done
    Write-Host ("   exit {0} in {1}s" -f $code, $seconds)
  }
  Start-Sleep -Milliseconds 700
}
