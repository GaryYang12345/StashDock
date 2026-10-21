param([string]$Destination = '')
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not $Destination) { $Destination = Join-Path $taskRoot 'output/StashDock-App-Icons-20261019.zip' }
$taskDestination = [IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $taskDestination) { throw 'Package exists. Choose a fresh destination.' }
$taskNames = @('LICENSE','assets/brand/icon.svg','scripts/generate-icon.ps1','scripts/generate-app-icons.mjs','scripts/package-app-icons.ps1','scripts/lib/icns.mjs','scripts/lib/write-if-changed.mjs','tests/app-icons.test.mjs','tests/brand-assets.test.mjs','docs/APP_ICON_HANDOFF.zh-CN.md','src-tauri/icons/icon.ico','src-tauri/icons/icon.png','src-tauri/icons/128x128.png')
$taskNames += @(Get-ChildItem -LiteralPath (Join-Path $taskRoot 'assets/app-icon') -File -Recurse | ForEach-Object { $_.FullName.Substring($taskRoot.Length+1).Replace('\','/') })
$taskRecords = @($taskNames | Sort-Object -Unique | ForEach-Object {
  $taskSource = Join-Path $taskRoot $_
  $taskFile = Get-Item -LiteralPath $taskSource
  if ($taskFile.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Unexpected linked icon source.' }
  [pscustomobject]@{path=$_;bytes=$taskFile.Length;sha256=(Get-FileHash -LiteralPath $taskSource -Algorithm SHA256).Hash.ToLowerInvariant()}
})
[void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($taskDestination))
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskZip = [IO.Compression.ZipFile]::Open($taskDestination,[IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($taskFile in $taskRecords) {
    # ZIP entry names are explicit forward-slash paths for macOS extraction.
    [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($taskZip,(Join-Path $taskRoot $taskFile.path),('StashDock-App-Icons/'+$taskFile.path),[IO.Compression.CompressionLevel]::Optimal)
  }
  [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($taskZip,(Join-Path $taskRoot 'docs/APP_ICON_HANDOFF.zh-CN.md'),'StashDock-App-Icons/START_HERE.zh-CN.md',[IO.Compression.CompressionLevel]::Optimal)
  $taskManifest = [ordered]@{formatVersion=1;kind='app-icon-source-overlay';baseTag='v0.2.5';applicationInstaller=$false;nativeLiquidGlassVerified=$false;files=$taskRecords}
  $taskEntry = $taskZip.CreateEntry('StashDock-App-Icons/ICON_HANDOFF_MANIFEST.json')
  $taskWriter = [IO.StreamWriter]::new($taskEntry.Open(),[Text.UTF8Encoding]::new($false))
  try { $taskWriter.Write(($taskManifest | ConvertTo-Json -Depth 5)) } finally { $taskWriter.Dispose() }
} finally { $taskZip.Dispose() }
$taskVerify = [IO.Compression.ZipFile]::OpenRead($taskDestination)
try {
  foreach ($taskFile in $taskRecords) {
    $taskEntry = $taskVerify.GetEntry('StashDock-App-Icons/'+$taskFile.path)
    if (-not $taskEntry -or $taskEntry.Length -ne $taskFile.bytes) { throw 'Icon archive entry mismatch.' }
    $taskStream = $taskEntry.Open(); $taskHasher = [Security.Cryptography.SHA256]::Create()
    try { $taskHash = [BitConverter]::ToString($taskHasher.ComputeHash($taskStream)).Replace('-','').ToLowerInvariant() }
    finally { $taskHasher.Dispose(); $taskStream.Dispose() }
    if ($taskHash -ne $taskFile.sha256) { throw 'Icon archive checksum mismatch.' }
  }
  if ($taskVerify.Entries.Count -ne $taskRecords.Count+2 -or @($taskVerify.Entries | Where-Object { $_.FullName.Contains('\') }).Count) { throw 'Unexpected archive paths.' }
} finally { $taskVerify.Dispose() }
[pscustomobject]@{archive=$taskDestination;files=$taskRecords.Count+2;bytes=(Get-Item -LiteralPath $taskDestination).Length;sha256=(Get-FileHash -LiteralPath $taskDestination).Hash.ToLowerInvariant();verified=$true} | ConvertTo-Json
