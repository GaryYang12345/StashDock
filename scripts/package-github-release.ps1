param(
  [Parameter(Mandatory=$true)][string]$PluginArchive,
  [Parameter(Mandatory=$true)][string]$PublicSource,
  [string]$Destination = ''
)
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskVersion = (Get-Content -Raw -LiteralPath (Join-Path $taskRoot 'package.json') | ConvertFrom-Json).version
$taskPluginVersion = (Get-Content -Raw -LiteralPath (Join-Path $taskRoot 'plugins/stashdock/.codex-plugin/plugin.json') | ConvertFrom-Json).version
$taskExtensionVersion = (Get-Content -Raw -LiteralPath (Join-Path $taskRoot 'extension/manifest.json') | ConvertFrom-Json).version
$taskPublicRoot = [IO.Path]::GetFullPath($PublicSource)
$taskPublicRemote = & git -C $taskPublicRoot remote get-url origin
if ($LASTEXITCODE -ne 0 -or $taskPublicRemote -ne 'https://github.com/StashDock/StashDock.git') { throw 'PublicSource must be the reviewed public distribution checkout.' }
$taskCommit = & git -C $taskPublicRoot rev-parse HEAD
if ($LASTEXITCODE -ne 0) { throw 'Commit the source baseline first.' }
$taskStatus = & git -C $taskRoot status --porcelain
if ($LASTEXITCODE -ne 0 -or $taskStatus) { throw 'Commit intended source changes before assembling a release.' }
$taskPublicStatus = & git -C $taskPublicRoot status --porcelain
if ($LASTEXITCODE -ne 0 -or $taskPublicStatus) { throw 'Commit the reviewed public source before assembling a release.' }
& node (Join-Path $PSScriptRoot 'verify-public-source.mjs') $taskPublicRoot
if ($LASTEXITCODE -ne 0) { throw 'Public source check failed.' }
if (-not $Destination) { $Destination = Join-Path $taskRoot "output/releases/v$taskVersion" }
$taskRelease = [IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $taskRelease) { throw 'Release directory exists. Never overwrite release assets.' }
$taskPluginZip = [IO.Path]::GetFullPath($PluginArchive)
if (-not (Test-Path -LiteralPath $taskPluginZip -PathType Leaf)) { throw 'Provide the verified complete plugin ZIP.' }
$taskInstaller = Join-Path $taskRoot "src-tauri/target/release/bundle/nsis/StashDock_$($taskVersion)_x64-setup.exe"
if (-not (Test-Path -LiteralPath $taskInstaller -PathType Leaf)) { throw 'Build the production Windows installer first.' }
[void][IO.Directory]::CreateDirectory($taskRelease)
Copy-Item -LiteralPath $taskInstaller -Destination (Join-Path $taskRelease ([IO.Path]::GetFileName($taskInstaller)))
Copy-Item -LiteralPath $taskPluginZip -Destination (Join-Path $taskRelease "stashdock-plugin-$taskPluginVersion-win32-x64.zip")
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskProductLinks = Get-Content -Raw -LiteralPath (Join-Path $taskRoot 'src-tauri/product-links.json') | ConvertFrom-Json
foreach ($taskBrowser in $taskProductLinks.publicBrowserExtensions) {
  $taskBrowserFolder = Join-Path $taskRoot "output/extensions/$taskBrowser"
  $taskManifest = Get-Content -Raw -LiteralPath (Join-Path $taskBrowserFolder 'manifest.json') | ConvertFrom-Json
  if ($taskManifest.version -ne $taskExtensionVersion) { throw "Rebuild $taskBrowser extension." }
  [IO.Compression.ZipFile]::CreateFromDirectory($taskBrowserFolder,(Join-Path $taskRelease "stashdock-extension-$taskBrowser-$taskExtensionVersion.zip"),[IO.Compression.CompressionLevel]::Optimal,$false)
}
# Internal handoff archives contain development rules and must never be public release assets.
$taskFiles = @(Get-ChildItem -LiteralPath $taskRelease -File | Sort-Object Name | ForEach-Object {
  [pscustomobject]@{name=$_.Name;bytes=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName).Hash.ToLowerInvariant()}
})
$taskMetadata = [ordered]@{
  formatVersion=1;repository='https://github.com/StashDock/StashDock';tag="v$taskVersion";sourceCommit=$taskCommit;
  versions=[ordered]@{desktop=$taskVersion;chatgptPlugin=$taskPluginVersion;browserExtensions=$taskExtensionVersion};
  platform='win32-x64';windowsCodeSigned=$false;browserStorePublished=$false;files=$taskFiles
}
$taskMetadataPath = Join-Path $taskRelease 'release.json'
[IO.File]::WriteAllText($taskMetadataPath,($taskMetadata | ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false))
$taskSums = @(Get-ChildItem -LiteralPath $taskRelease -File | Sort-Object Name | ForEach-Object { (Get-FileHash -LiteralPath $_.FullName).Hash.ToLowerInvariant() + '  ' + $_.Name })
[IO.File]::WriteAllText((Join-Path $taskRelease 'SHA256SUMS.txt'),(($taskSums -join "`n")+"`n"),[Text.UTF8Encoding]::new($false))
[pscustomobject]@{directory=$taskRelease;sourceCommit=$taskCommit;assets=@(Get-ChildItem -LiteralPath $taskRelease -File | Select-Object Name,Length)} | ConvertTo-Json -Depth 4
