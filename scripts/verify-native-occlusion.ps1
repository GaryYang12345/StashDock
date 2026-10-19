# Read-only verification of the displayed desktop surface. No HWND mutations.
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class StashDockOcclusionProbe {
  [StructLayout(LayoutKind.Sequential)]
  public struct Rect { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out Rect bounds);
  [DllImport("user32.dll")] public static extern int GetWindowRgnBox(IntPtr hwnd, out Rect bounds);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
}
'@
$instances = @(Get-Process stashdock -ErrorAction SilentlyContinue)
if ($instances.Count -ne 1) { throw 'Expected exactly one running StashDock instance.' }
$instance = $instances[0]
$handle = $instance.MainWindowHandle
if ($handle -eq [IntPtr]::Zero -or -not [StashDockOcclusionProbe]::IsWindowVisible($handle)) {
  throw 'Show the StashDock folder or panel before running this read-only check.'
}
$windowBounds = New-Object StashDockOcclusionProbe+Rect
$regionBounds = New-Object StashDockOcclusionProbe+Rect
if (-not [StashDockOcclusionProbe]::GetWindowRect($handle, [ref]$windowBounds)) { throw 'Could not read window bounds.' }
$regionType = [StashDockOcclusionProbe]::GetWindowRgnBox($handle, [ref]$regionBounds)
if ($regionType -ne 3) { throw "Region type $regionType is not COMPLEXREGION; Chromium may falsely occlude the full canvas." }
[pscustomobject]@{
  ProcessId = $instance.Id
  Executable = $instance.Path
  RegionType = $regionType
  OcclusionExclusion = 'COMPLEXREGION'
  WindowBounds = $windowBounds
  RegionBounds = $regionBounds
} | ConvertTo-Json -Depth 3
