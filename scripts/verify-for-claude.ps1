# One command for the Windows-only checks Claude cannot run from its Linux shell.
# Writes every log to output\claude-review\<timestamp>\ for Claude to read.
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-for-claude.ps1 [-Steps test,diagnose]
param([string[]]$Steps = @('test', 'diagnose'), [string]$Source = 'chrome:Default', [int]$Limit = 60, [int]$Screenshots = 15)
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$out = Join-Path $root ("output\claude-review\" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force -Path $out | Out-Null
$summary = [ordered]@{ started = (Get-Date).ToString('o'); commit = (git rev-parse --short HEAD); steps = [ordered]@{} }

function Run-Step([string]$name, [string]$command) {
  Write-Host "== $name" -ForegroundColor Cyan
  $log = Join-Path $out "$name.log"
  $timer = [Diagnostics.Stopwatch]::StartNew()
  cmd /c "$command > `"$log`" 2>&1"
  $summary.steps[$name] = [ordered]@{ exitCode = $LASTEXITCODE; seconds = [math]::Round($timer.Elapsed.TotalSeconds, 1) }
  Write-Host ("   exit {0} in {1}s -> {2}" -f $LASTEXITCODE, $summary.steps[$name].seconds, $log)
}

if ($Steps -contains 'test') {
  Run-Step 'typecheck' 'npx tsc -b'
  Run-Step 'frontend-tests' 'node --test --test-reporter=tap tests/*.test.mjs'
  Run-Step 'desktop-tests' 'npm run desktop:test'
}
if ($Steps -contains 'diagnose') {
  $installed = 'plugins\stashdock\bin\win32-x64\stashdock-preview.exe'
  $built = 'src-tauri\target\release\stashdock-preview.exe'
  if (Test-Path $installed) { Run-Step 'diagnose-before' "node scripts/diagnose-link-import.mjs --helper $installed --readers 4 --source $Source --limit $Limit --screenshots $Screenshots --out `"$out\diag-before`"" }
  Run-Step 'build-helper' 'npm run preview:helper'
  Run-Step 'diagnose-after' "node scripts/diagnose-link-import.mjs --helper $built --source $Source --limit $Limit --screenshots $Screenshots --out `"$out\diag-after`""
}
$summary.finished = (Get-Date).ToString('o')
$summary | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 (Join-Path $out 'summary.json')
Write-Host "Done. Tell Claude: $out" -ForegroundColor Green
