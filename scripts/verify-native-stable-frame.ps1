param([Parameter(Mandatory=$true)][int]$AppProcessId, [ValidateRange(500,60000)][int]$ObserveMs=30000)
$ErrorActionPreference='Stop'
$taskApp=Get-Process -Id $AppProcessId
if($taskApp.Path -notin @('D:\StashDock\stashdock.exe','D:\StashDock\src-tauri\target\release\stashdock.exe')) { throw 'Only this project application is in scope.' }
# Read-only geometry sampling while normal UI handoffs are tested separately.
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class StableFrameProbe {
 public delegate bool EnumProc(IntPtr window,IntPtr parameter);
 [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
 [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback,IntPtr parameter);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window,out uint process);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr window,StringBuilder text,int length);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window,out Rect rect);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
}
'@
$taskWindows=New-Object 'System.Collections.Generic.Dictionary[string,System.IntPtr]'
$taskCallback=[StableFrameProbe+EnumProc]{ param($window,$parameter)
 [uint32]$owner=0; [void][StableFrameProbe]::GetWindowThreadProcessId($window,[ref]$owner)
 if($owner -eq $AppProcessId) {
  $title=New-Object System.Text.StringBuilder 100; [void][StableFrameProbe]::GetWindowText($window,$title,100)
  if($title.ToString() -in @('StashDock','StashDock folder')) { $taskWindows[$title.ToString()]=$window }
 }
 return $true
}
[void][StableFrameProbe]::EnumWindows($taskCallback,[IntPtr]::Zero)
if($taskWindows.Count -ne 2) { throw 'Both native surfaces must exist.' }
$taskBounds=@{}
foreach($title in $taskWindows.Keys) {
 $rect=New-Object StableFrameProbe+Rect; [void][StableFrameProbe]::GetWindowRect($taskWindows[$title],[ref]$rect)
 $taskBounds[$title]=@($rect.Left,$rect.Top,($rect.Right-$rect.Left),($rect.Bottom-$rect.Top))
}
$taskTimer=[System.Diagnostics.Stopwatch]::StartNew(); $samples=0; $changes=0; $last=''; $states=@()
while($taskTimer.ElapsedMilliseconds -lt $ObserveMs) {
 $shown=@()
 foreach($title in $taskWindows.Keys) {
  $rect=New-Object StableFrameProbe+Rect; [void][StableFrameProbe]::GetWindowRect($taskWindows[$title],[ref]$rect)
  $current=@($rect.Left,$rect.Top,($rect.Right-$rect.Left),($rect.Bottom-$rect.Top))
  if(($current -join ',') -ne ($taskBounds[$title] -join ',')) { throw "Native frame changed during a content-only handoff: $title" }
  if([StableFrameProbe]::IsWindowVisible($taskWindows[$title])) { $shown+=$title }
 }
 $next=($shown | Sort-Object) -join ','
 if($next -ne $last) { $states+=$next; $changes++; $last=$next }
 $samples++; Start-Sleep -Milliseconds 10
}
@{samples=$samples;visibilityChanges=$changes;states=$states;stableBounds=$taskBounds} | ConvertTo-Json -Compress -Depth 4
