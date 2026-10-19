param([Parameter(Mandatory=$true)][string]$Pinterest, [Parameter(Mandatory=$true)][string]$Instagram)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
foreach ($entry in @(@{Name='pinterest';Path=$Pinterest},@{Name='instagram';Path=$Instagram})) {
  $source=[System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $entry.Path).Path)
  $bitmap=New-Object System.Drawing.Bitmap 128,128
  $graphics=[System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($source,0,0,128,128)
    $destination=Join-Path $PSScriptRoot ('../src/assets/brands/'+$entry.Name+'.png')
    $bitmap.Save($destination,[System.Drawing.Imaging.ImageFormat]::Png)
  } finally { $graphics.Dispose();$bitmap.Dispose();$source.Dispose() }
}
