param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet("dev", "build", "check", "test", "preview-build", "preview-debug", "release-binaries", "browser-build")]
  [string]$Action
)

$ErrorActionPreference = "Stop"

& node (Join-Path $PSScriptRoot "sync-pdf-assets.mjs")
if ($LASTEXITCODE -ne 0) { throw "PDF runtime preparation failed" }

$vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
if (-not (Test-Path -LiteralPath $vswhere)) {
  throw "Visual Studio Installer was not found. Install Microsoft C++ Build Tools first."
}

$installationPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $installationPath) {
  throw "Visual Studio C++ Build Tools were not found. Add the Desktop development with C++ workload."
}

$developerShell = Join-Path $installationPath "Common7\Tools\VsDevCmd.bat"
if (-not (Test-Path -LiteralPath $developerShell)) {
  throw "VsDevCmd.bat was not found at $developerShell"
}

# Import the environment produced by the Visual Studio developer shell into
# this PowerShell process so rustc can find link.exe and the Windows SDK.
$environmentLines = & $env:COMSPEC /s /c "`"$developerShell`" -arch=x64 -host_arch=x64 >nul && set"
foreach ($line in $environmentLines) {
  if ($line -match "^([^=]+)=(.*)$") {
    Set-Item -Path "Env:$($matches[1])" -Value $matches[2]
  }
}

$userRustupHome = [Environment]::GetEnvironmentVariable("RUSTUP_HOME", "User")
$userCargoHome = [Environment]::GetEnvironmentVariable("CARGO_HOME", "User")
if ($userRustupHome) {
  $env:RUSTUP_HOME = $userRustupHome
}
if ($userCargoHome) {
  $env:CARGO_HOME = $userCargoHome
  $cargoBin = Join-Path $env:CARGO_HOME "bin"
$env:Path = "$cargoBin;$env:Path"
}

$userDataDir = [Environment]::GetEnvironmentVariable("STASHDOCK_DATA_DIR", "User")
if ($userDataDir) {
  $env:STASHDOCK_DATA_DIR = $userDataDir
}

# A standard Visual Studio installation already exposes the Windows SDK here.
# On storage-constrained machines, STASHDOCK_XWIN_ROOT can point at an xwin
# cache containing the extracted `crt` and `sdk` directories instead.
$hasWindowsSdk = $env:LIB -split ";" | Where-Object {
  $_ -and (Test-Path -LiteralPath (Join-Path $_ "kernel32.lib"))
}

if (-not $hasWindowsSdk) {
  $xwinRoot = [Environment]::GetEnvironmentVariable("STASHDOCK_XWIN_ROOT", "Process")
  if (-not $xwinRoot) {
    $xwinRoot = [Environment]::GetEnvironmentVariable("STASHDOCK_XWIN_ROOT", "User")
  }

  if (-not $xwinRoot -or -not (Test-Path -LiteralPath (Join-Path $xwinRoot "sdk\lib\um\x86_64\kernel32.Lib"))) {
    throw "Windows SDK libraries were not found. Install the Windows 10/11 SDK, or set STASHDOCK_XWIN_ROOT to an extracted xwin cache."
  }

  $xwinLibraryPaths = @(
    (Join-Path $xwinRoot "crt\lib\x86_64"),
    (Join-Path $xwinRoot "sdk\lib\ucrt\x86_64"),
    (Join-Path $xwinRoot "sdk\lib\um\x86_64")
  )
  $xwinIncludePaths = @(
    (Join-Path $xwinRoot "crt\include"),
    (Join-Path $xwinRoot "sdk\include\ucrt"),
    (Join-Path $xwinRoot "sdk\include\um"),
    (Join-Path $xwinRoot "sdk\include\shared"),
    (Join-Path $xwinRoot "sdk\include\winrt"),
    (Join-Path $xwinRoot "sdk\include\cppwinrt")
  )

  $env:LIB = (($xwinLibraryPaths + @($env:LIB)) -join ";")
  $env:INCLUDE = (($xwinIncludePaths + @($env:INCLUDE)) -join ";")
}

# Tauri normally uses the SDK's rc.exe. If an xwin-only setup has no rc.exe,
# STASHDOCK_WINDRES can point at GNU windres and this script builds a tiny local
# argument adapter outside the source tree.
$resourceCompiler = Get-Command rc.exe -ErrorAction SilentlyContinue
if (-not $resourceCompiler) {
  $windres = [Environment]::GetEnvironmentVariable("STASHDOCK_WINDRES", "Process")
  if (-not $windres) {
    $windres = [Environment]::GetEnvironmentVariable("STASHDOCK_WINDRES", "User")
  }
  if (-not $windres) {
    $windresCommand = Get-Command windres.exe -ErrorAction SilentlyContinue
    if ($windresCommand) {
      $windres = $windresCommand.Source
    }
  }

  if (-not $windres -or -not (Test-Path -LiteralPath $windres)) {
    throw "A Windows resource compiler was not found. Install the Windows SDK, or set STASHDOCK_WINDRES to windres.exe."
  }

  $gccCommand = Get-Command gcc.exe -ErrorAction SilentlyContinue
  if (-not $gccCommand) {
    $gccCandidate = Join-Path (Split-Path -Parent $windres) "gcc.exe"
    if (Test-Path -LiteralPath $gccCandidate) {
      $gccCommand = Get-Item -LiteralPath $gccCandidate
    }
  }
  if (-not $gccCommand) {
    throw "gcc.exe is required once to build the windres adapter."
  }

  $env:STASHDOCK_WINDRES = $windres
  $rcTools = Join-Path ([Environment]::GetFolderPath("LocalApplicationData")) "StashDock\dev-tools"
  $rcWrapper = Join-Path $rcTools "rc.exe"
  if (-not (Test-Path -LiteralPath $rcWrapper)) {
    New-Item -ItemType Directory -Force -Path $rcTools | Out-Null
    $wrapperSource = Join-Path $PSScriptRoot "rc-wrapper.c"
    & $gccCommand.Source -O2 $wrapperSource -o $rcWrapper
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to build the Windows resource compiler adapter."
    }
  }
  $env:RC = $rcWrapper
}

if ($Action -in @("check", "test", "preview-build", "preview-debug", "release-binaries", "browser-build")) {
  # Helpers and library tests are built before the installer resources exist.
  # Only the actual desktop build embeds/bundles those external resources.
  $taskOriginalTauriConfig = $env:TAURI_CONFIG
  if ($Action -ne "release-binaries") {
    $taskCompileConfig = if ($env:TAURI_CONFIG) { $env:TAURI_CONFIG | ConvertFrom-Json } else { [pscustomobject]@{} }
    if (-not $taskCompileConfig.bundle) { $taskCompileConfig | Add-Member -NotePropertyName bundle -NotePropertyValue ([pscustomobject]@{}) }
    $taskCompileConfig.bundle | Add-Member -NotePropertyName resources -NotePropertyValue $null -Force
    $env:TAURI_CONFIG = $taskCompileConfig | ConvertTo-Json -Depth 20 -Compress
  }
  Push-Location (Join-Path $PSScriptRoot "..\src-tauri")
  try {
    if ($Action -eq "release-binaries") {
      # Backend-only changes use the already verified frontend bundle and build
      # desktop/helper together, without rewriting it between Rust builds.
      # Release optimization alone does NOT switch Tauri out of development
      # mode. Match the Tauri CLI's production feature so assets are embedded
      # and the installed app never depends on the localhost dev server.
      & cargo build --release --bins --features tauri/custom-protocol
    }
    elseif ($Action -eq "preview-build") {
      & cargo build --release --bin stashdock-preview --bin stashdock-storage --bin stashdock-browser --features tauri/custom-protocol
    }
    elseif ($Action -eq "browser-build") {
      & cargo build --release --bin stashdock-browser --features tauri/custom-protocol
    }
    elseif ($Action -eq "preview-debug") {
      & cargo build --bin stashdock-preview
    }
    elseif ($Action -eq "test") {
      & cargo test
    }
    else {
      & cargo check
    }
    exit $LASTEXITCODE
  }
  finally {
    $env:TAURI_CONFIG = $taskOriginalTauriConfig
    Pop-Location
  }
}

& npm exec tauri -- $Action
exit $LASTEXITCODE
