param([Parameter(Mandatory=$true)][string]$InstallDir)
$ErrorActionPreference = 'Stop'
try {
  $target = [IO.Path]::GetFullPath($InstallDir).TrimEnd('\')
  if ($target -eq [IO.Path]::GetPathRoot($target).TrimEnd('\')) { exit 4 }
  foreach ($marker in @('runtime.json', 'runtime-settings.json', 'python\python.exe', 'versions')) {
    if (Test-Path -LiteralPath (Join-Path $target $marker)) { exit 4 }
  }
  $prefix = $target + '\'
  $running = Get-CimInstance -ClassName Win32_Process | Where-Object {
    $_.ExecutablePath -and $_.ExecutablePath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)
  }
  if ($running) { exit 3 }
  exit 0
} catch { exit 1 }
