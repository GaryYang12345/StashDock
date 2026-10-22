# Measures the same sites directly and through the Windows system proxy with
# curl.exe, independently of StashDock, so routing problems can be attributed.
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\probe-proxy.ps1
$settings = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'
$proxy = if ($settings.ProxyEnable -eq 1) { $settings.ProxyServer } else { $null }
# Extra sites (one http/https URL per line) may be listed in output\claude-review\queue\sites.txt.
$extra = Join-Path (Split-Path -Parent $PSScriptRoot) 'output\claude-review\queue\sites.txt'
$listed = if (Test-Path $extra) { @(Get-Content $extra | Where-Object { $_ -match '^https?://[^\s"]+$' }) } else { @() }
$sites = $listed + 'https://www.baidu.com/', 'https://blog.csdn.net/', 'https://book.douban.com/', 'https://zhuanlan.zhihu.com/', 'https://www.youtube.com/', 'https://github.com/', 'https://developer.mozilla.org/'
$out = Join-Path (Split-Path -Parent $PSScriptRoot) ("output\claude-review\probe-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.txt')
New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
$lines = @("proxy=$proxy bypass=$($settings.ProxyOverride) pac=$($settings.AutoConfigURL)")
foreach ($site in $sites) {
  foreach ($route in 'direct', 'proxy') {
    if ($route -eq 'proxy' -and -not $proxy) { continue }
    $routeArgs = if ($route -eq 'proxy') { @('-x', "http://$($proxy -replace '^https?://', '')") } else { @('--noproxy', '*') }
    $result = & curl.exe -s -o NUL -m 15 -A 'Mozilla/5.0' -w 'code=%{http_code} connect=%{time_connect}s tls=%{time_appconnect}s total=%{time_total}s' @routeArgs $site 2>&1
    $lines += "{0,-32} {1,-6} {2}  (curl exit {3})" -f $site, $route, $result, $LASTEXITCODE
  }
}
# How a listed site answers StashDock's reader versus a browser.
foreach ($site in $listed) {
  foreach ($agent in @('StashDock/0.2.5 WebPreview', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36')) {
    $result = & curl.exe -s -o NUL -m 15 -A $agent -H 'Accept: text/html,application/xhtml+xml' -w 'code=%{http_code} bytes=%{size_download} total=%{time_total}s' $site 2>&1
    $lines += "{0,-32} agent={1,-12} {2}" -f $site, $agent.Substring(0, [Math]::Min(12, $agent.Length)), $result
  }
}
$lines | Tee-Object -FilePath $out
Write-Host "Saved: $out" -ForegroundColor Green
