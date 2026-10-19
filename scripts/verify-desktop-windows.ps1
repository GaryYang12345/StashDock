param([Parameter(Mandatory=$true)][int]$AppProcessId,[ValidateSet('panel','folder','hidden')][string]$Surface='panel')
$ErrorActionPreference='Stop'
$application=Get-Process -Id $AppProcessId
$allowed=@('D:\StashDock\stashdock.exe','D:\StashDock\src-tauri\target\release\stashdock.exe')
if($application.Path -notin $allowed){throw 'Only the installed or project-built StashDock is in scope.'}
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class DesktopWindowCheck {
 public delegate bool EnumProc(IntPtr window,IntPtr parameter);
 [StructLayout(LayoutKind.Sequential)] public struct Rect {public int Left,Top,Right,Bottom;}
 [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback,IntPtr parameter);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window,out uint process);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr window,StringBuilder name,int length);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr window,StringBuilder name,int length);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
 [DllImport("user32.dll",EntryPoint="GetWindowLongPtrW")] public static extern IntPtr GetStyle(IntPtr window,int index);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window,out Rect rect);
 [DllImport("gdi32.dll")] public static extern IntPtr CreateRectRgn(int a,int b,int c,int d);
 [DllImport("gdi32.dll")] public static extern bool DeleteObject(IntPtr region);
 [DllImport("user32.dll")] public static extern int GetWindowRgn(IntPtr window,IntPtr region);
 [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr window,uint attribute,out int value,int size);
 [DllImport("dwmapi.dll")] public static extern int DwmIsCompositionEnabled(out int enabled);
}
'@
$windows=New-Object 'System.Collections.Generic.Dictionary[string,System.IntPtr]'
$obsolete=0
$callback=[DesktopWindowCheck+EnumProc]{param($window,$parameter)
 [uint32]$owner=0
 [void][DesktopWindowCheck]::GetWindowThreadProcessId($window,[ref]$owner)
 if($owner -eq $AppProcessId){
  $title=New-Object System.Text.StringBuilder 200
  $class=New-Object System.Text.StringBuilder 200
  [void][DesktopWindowCheck]::GetWindowText($window,$title,200)
  [void][DesktopWindowCheck]::GetClassName($window,$class,200)
  if($class.ToString() -in @('StashDockNativeShadow','StashDockVisualHandoff')){$script:obsolete++}
  if($title.ToString() -in @('StashDock','StashDock folder')){$windows[$title.ToString()]=$window}
 }
 return $true
}
[void][DesktopWindowCheck]::EnumWindows($callback,[IntPtr]::Zero)
if($windows.Count -ne 2){throw 'Both independent native windows must exist.'}
if($obsolete -ne 0){throw 'An obsolete custom shadow or animation window is still present.'}
$results=@()
foreach($title in @('StashDock','StashDock folder')){
 $window=$windows[$title]
 $folder=$title -eq 'StashDock folder'
 $topmost=([DesktopWindowCheck]::GetStyle($window,-20).ToInt64() -band 8) -ne 0
 if($topmost -ne $folder){throw "Unexpected topmost policy: $title"}
 $visible=[DesktopWindowCheck]::IsWindowVisible($window)
 $expected=($Surface -eq 'folder' -and $folder) -or ($Surface -eq 'panel' -and -not $folder)
 if($visible -ne $expected){throw "Unexpected visibility: $title"}
 $rect=New-Object DesktopWindowCheck+Rect
 [void][DesktopWindowCheck]::GetWindowRect($window,[ref]$rect)
 $region=[DesktopWindowCheck]::CreateRectRgn(0,0,0,0)
 try{$kind=[DesktopWindowCheck]::GetWindowRgn($window,$region)}finally{[void][DesktopWindowCheck]::DeleteObject($region)}
 if(-not $folder -and $kind -ne 0){throw 'The panel still has a custom clipping region.'}
 if(-not $folder -and ([DesktopWindowCheck]::GetStyle($window,-16).ToInt64() -band 0x40000) -eq 0){throw 'Native resize frame is missing.'}
 if($folder -and $kind -ne 3){throw 'Transparent folder must have a bounded complex region.'}
 [int]$nc=0;[int]$corner=0
 $ncResult=[DesktopWindowCheck]::DwmGetWindowAttribute($window,1,[ref]$nc,4)
 $cornerResult=[DesktopWindowCheck]::DwmGetWindowAttribute($window,33,[ref]$corner,4)
 $results+=@{title=$title;visible=$visible;topmost=$topmost;width=$rect.Right-$rect.Left;height=$rect.Bottom-$rect.Top;customRegion=$kind;dwmNonClient=if($ncResult -eq 0){$nc}else{$null};cornerPreference=if($cornerResult -eq 0){$corner}else{$null}}
}
[int]$composition=0
if([DesktopWindowCheck]::DwmIsCompositionEnabled([ref]$composition) -ne 0 -or $composition -eq 0){throw 'System window composition is unavailable.'}
$results | ConvertTo-Json -Compress
