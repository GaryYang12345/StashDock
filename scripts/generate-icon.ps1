$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

# Brand source files are never modified. Generated icons preserve their aspect
# ratio and transparency; no substitute glyphs, backgrounds, or hand-drawn marks.
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$sourcePath = Join-Path $projectRoot "assets\brand\icon.png"
$source = [System.Drawing.Image]::FromFile($sourcePath)
$nativeDir = Join-Path $projectRoot "src-tauri\icons"
$extensionDir = Join-Path $projectRoot "extension\icons"
$generatedDir = Join-Path $projectRoot "assets\generated"
foreach ($directory in @($nativeDir, $extensionDir, $generatedDir)) {
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
}

function Render-BrandPng([int]$size) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $stream = New-Object System.IO.MemoryStream
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    # Fit, don't stretch the non-square brand export into a square system icon.
    $scale = [Math]::Min($size / $source.Width, $size / $source.Height)
    $width = [single]($source.Width * $scale)
    $height = [single]($source.Height * $scale)
    $destination = New-Object System.Drawing.RectangleF(([single](($size - $width) / 2)), ([single](($size - $height) / 2)), $width, $height)
    $graphics.DrawImage($source, $destination)
    $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    return ,$stream.ToArray()
  }
  finally {
    $stream.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

try {
  # Transparent marks remain appropriate for the tray and browser toolbar.
  $sizes = @(16, 32, 48, 128)
  $images = @{}
  foreach ($size in $sizes) {
    $images[$size] = Render-BrandPng $size
  }
  [System.IO.File]::WriteAllBytes((Join-Path $nativeDir "32x32.png"), $images[32])
  foreach ($size in @(16, 32, 48, 128)) {
    [System.IO.File]::WriteAllBytes((Join-Path $extensionDir "icon-$size.png"), $images[$size])
  }

  # Same supplied SVG for browser tabs, with only its ink adapted to browser
  # chrome's light/dark preference. Vite gives this file a content-hashed URL.
  $svg = [System.IO.File]::ReadAllText((Join-Path $projectRoot "assets\brand\icon.svg"))
  $svg = $svg.Replace('fill="black"', 'fill="currentColor"')
  $svg = $svg.Replace('<path ', '<style>:root{color:#161616}@media(prefers-color-scheme:dark){:root{color:#f5f5f5}}</style><path ')
  [System.IO.File]::WriteAllText((Join-Path $generatedDir "favicon.svg"), $svg, (New-Object System.Text.UTF8Encoding($false)))
}
finally { $source.Dispose() }

& node (Join-Path $PSScriptRoot "generate-app-icons.mjs")
if ($LASTEXITCODE -ne 0) { throw 'App icon export failed.' }
Write-Output "Generated square app icons, transparent tray/browser marks and favicon."
