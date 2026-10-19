param([string]$Destination = '')
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskVersion = (Get-Content -Raw -LiteralPath (Join-Path $taskRoot 'package.json') | ConvertFrom-Json).version
if (-not $Destination) { $Destination = Join-Path $taskRoot "output\releases\StashDock-Mac-Handoff-v$taskVersion.zip" }
$taskDestination = [IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $taskDestination) { throw 'Archive exists. Choose another destination.' }
$taskCommit = & git -C $taskRoot rev-parse HEAD
if ($LASTEXITCODE -ne 0 -or $taskCommit -notmatch '^[0-9a-f]{40}$') { throw 'Commit the source baseline first.' }
& git -C $taskRoot diff --quiet HEAD -- .agents/skills/arc AGENTS.md design.md docs scripts/package-mac-handoff.ps1 scripts/verify-handoff.mjs
if ($LASTEXITCODE -ne 0) { throw 'Commit handoff inputs before packaging.' }
$taskStage = Join-Path ([IO.Path]::GetTempPath()) ('stashdock-mac-guide-' + [guid]::NewGuid().ToString('N'))
$taskPackage = Join-Path $taskStage 'StashDock-Mac-Handoff'
[void][IO.Directory]::CreateDirectory($taskPackage)
$taskRecords = [Collections.Generic.List[object]]::new()
function Add-HandoffFile([string]$Source, [string]$Relative) {
  $taskTarget = Join-Path $taskPackage $Relative
  [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($taskTarget))
  Copy-Item -LiteralPath $Source -Destination $taskTarget
  $taskHash = (Get-FileHash -LiteralPath $Source -Algorithm SHA256).Hash.ToLowerInvariant()
  if ((Get-FileHash -LiteralPath $taskTarget -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskHash) { throw "Copy mismatch: $Relative" }
  $taskRecords.Add([pscustomobject]@{path=$Relative.Replace('\','/');bytes=(Get-Item -LiteralPath $taskTarget).Length;sha256=$taskHash})
}
foreach ($taskFile in @('AGENTS.md','design.md','docs/MAC_START_HERE.zh-CN.md','docs/MAC_HANDOFF_PROMPT.zh-CN.md','docs/MAC_MIGRATION_HANDOFF.zh-CN.md','docs/product-principles.md','docs/architecture.md','docs/product-surfaces.md','docs/windows-runtime-release.md','docs/RELEASING.md')) {
  Add-HandoffFile (Join-Path $taskRoot $taskFile) $taskFile
}
Add-HandoffFile (Join-Path $taskRoot 'docs/MAC_START_HERE.zh-CN.md') 'START_HERE.zh-CN.md'
Add-HandoffFile (Join-Path $taskRoot 'scripts/verify-handoff.mjs') 'verify-handoff.mjs'
Get-ChildItem -LiteralPath (Join-Path $taskRoot '.agents/skills/arc') -File -Recurse -Force | ForEach-Object {
  if ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Unexpected skill symlink.' }
  $taskRelative = $_.FullName.Substring($taskRoot.Length + 1).Replace('\','/')
  Add-HandoffFile $_.FullName $taskRelative
}
$taskBaseline = [ordered]@{repository='https://github.com/GaryYang12345/StashDock';sourceCommit=$taskCommit;sourceTag="v$taskVersion";branch='feat/macos-arm64';macBuildVerified=$false}
[IO.File]::WriteAllText((Join-Path $taskPackage 'BASELINE.json'),($taskBaseline | ConvertTo-Json),[Text.UTF8Encoding]::new($false))
$taskRecords.Add([pscustomobject]@{path='BASELINE.json';bytes=(Get-Item -LiteralPath (Join-Path $taskPackage 'BASELINE.json')).Length;sha256=(Get-FileHash -LiteralPath (Join-Path $taskPackage 'BASELINE.json')).Hash.ToLowerInvariant()})
$taskManifest = [ordered]@{formatVersion=2;kind='github-source-handoff';createdAt=[DateTimeOffset]::UtcNow.ToString('o');sourceCommit=$taskCommit;macBuildVerified=$false;files=@($taskRecords | Sort-Object path)}
[IO.File]::WriteAllText((Join-Path $taskPackage 'HANDOFF_MANIFEST.json'),($taskManifest | ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false))
& node (Join-Path $taskPackage 'verify-handoff.mjs') $taskPackage
if ($LASTEXITCODE -ne 0) { throw 'Staged handoff verification failed.' }
[void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($taskDestination))
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($taskStage,$taskDestination,[IO.Compression.CompressionLevel]::Optimal,$false)
$taskExtracted = Join-Path $taskStage 'extracted'
[IO.Compression.ZipFile]::ExtractToDirectory($taskDestination,$taskExtracted)
& node (Join-Path $taskExtracted 'StashDock-Mac-Handoff/verify-handoff.mjs') (Join-Path $taskExtracted 'StashDock-Mac-Handoff')
if ($LASTEXITCODE -ne 0) { throw 'Extracted handoff verification failed.' }
[pscustomobject]@{archive=$taskDestination;files=$taskRecords.Count;bytes=(Get-Item -LiteralPath $taskDestination).Length;sourceCommit=$taskCommit;sha256=(Get-FileHash -LiteralPath $taskDestination).Hash.ToLowerInvariant()} | ConvertTo-Json
