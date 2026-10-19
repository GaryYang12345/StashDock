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
  $sizes = @(16, 20, 24, 32, 40, 48, 64, 128, 256)
  $images = @{}
  foreach ($size in $sizes) {
    $images[$size] = Render-BrandPng $size
  }
  [System.IO.File]::WriteAllBytes((Join-Path $nativeDir "icon.png"), $images[256])
  [System.IO.File]::WriteAllBytes((Join-Path $nativeDir "32x32.png"), $images[32])
  [System.IO.File]::WriteAllBytes((Join-Path $nativeDir "128x128.png"), $images[128])
  foreach ($size in @(16, 32, 48, 128)) {
    [System.IO.File]::WriteAllBytes((Join-Path $extensionDir "icon-$size.png"), $images[$size])
  }

  # Multi-resolution ICO: sharp at Windows taskbar, tray, Explorer and installer
  # sizes. Each directory entry references the matching branded PNG, not a copy
  # of a single 256px raster scaled by the shell.
  $iconStream = New-Object System.IO.MemoryStream
  $writer = New-Object System.IO.BinaryWriter($iconStream)
  try {
    $writer.Write([uint16]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]$sizes.Count)
    $offset = 6 + 16 * $sizes.Count
    foreach ($size in $sizes) {
      $dimension = if ($size -eq 256) { 0 } else { $size }
      $writer.Write([byte]$dimension)
      $writer.Write([byte]$dimension)
      $writer.Write([byte]0)
      $writer.Write([byte]0)
      $writer.Write([uint16]1)
      $writer.Write([uint16]32)
      $writer.Write([uint32]$images[$size].Length)
      $writer.Write([uint32]$offset)
      $offset += $images[$size].Length
    }
    foreach ($size in $sizes) { $writer.Write([byte[]]$images[$size]) }
    $writer.Flush()
    [System.IO.File]::WriteAllBytes((Join-Path $nativeDir "icon.ico"), $iconStream.ToArray())
  }
  finally { $writer.Dispose(); $iconStream.Dispose() }

  # Same supplied SVG for browser tabs, with only its ink adapted to browser
  # chrome's light/dark preference. Vite gives this file a content-hashed URL.
  $svg = [System.IO.File]::ReadAllText((Join-Path $projectRoot "assets\brand\icon.svg"))
  $svg = $svg.Replace('fill="black"', 'fill="currentColor"')
  $svg = $svg.Replace('<path ', '<style>:root{color:#161616}@media(prefers-color-scheme:dark){:root{color:#f5f5f5}}</style><path ')
  [System.IO.File]::WriteAllText((Join-Path $generatedDir "favicon.svg"), $svg, (New-Object System.Text.UTF8Encoding($false)))
}
finally { $source.Dispose() }

Write-Output "Generated StashDock brand ICO, native/tray PNGs, browser favicon and extension icons."
