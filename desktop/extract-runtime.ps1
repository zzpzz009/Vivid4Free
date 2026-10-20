param(
  [Parameter(Mandatory=$true)][string]$Archive,
  [Parameter(Mandatory=$true)][long]$MaxUnpackedBytes,
  [string]$Destination,
  [switch]$ValidateOnly
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($Archive)
try {
  if ($zip.Entries.Count -gt 250000) { throw 'ZIP contains more than 250000 entries' }
  $seen = New-Object 'System.Collections.Generic.Dictionary[string,string]' ([System.StringComparer]::OrdinalIgnoreCase)
  [long]$total = 0
  foreach ($entry in $zip.Entries) {
    $name = $entry.FullName
    if ([string]::IsNullOrEmpty($name) -or $name.Contains('\') -or $name.Contains(':') -or $name -match '[\x00-\x1f]' -or $name.StartsWith('/') -or $name -match '^[A-Za-z]:') {
      throw "ZIP contains an unsafe path: $name"
    }
    $isDirectory = $name.EndsWith('/')
    $clean = if ($isDirectory) { $name.Substring(0, $name.Length - 1) } else { $name }
    $parts = $clean.Split([char]'/')
    $unsafePart = @($parts | Where-Object { $_ -eq '' -or $_ -eq '.' -or $_ -eq '..' })
    if ([string]::IsNullOrEmpty($clean) -or $unsafePart.Count -gt 0) {
      throw "ZIP contains an unsafe path: $name"
    }
    $mode = ([int]$entry.ExternalAttributes -shr 16) -band 0xF000
    if (($mode -ne 0 -and $mode -ne 0x8000 -and $mode -ne 0x4000) -or (([int]$entry.ExternalAttributes -band 0x400) -ne 0)) {
      throw "ZIP contains a link or special file: $name"
    }
    if ($seen.ContainsKey($clean)) { throw "ZIP contains a duplicate path: $name" }
    $seen.Add($clean, $(if ($isDirectory) { 'dir' } else { 'file' }))
    if (-not $isDirectory) {
      $total += $entry.Length
      if ($total -gt $MaxUnpackedBytes) { throw 'ZIP expands beyond the manifest size limit' }
    }
  }
  foreach ($name in $seen.Keys) {
    $parts = $name.Split([char]'/')
    for ($i = 1; $i -lt $parts.Length; $i++) {
      $parent = [string]::Join('/', $parts[0..($i - 1)])
      if ($seen.ContainsKey($parent) -and $seen[$parent] -eq 'file') { throw 'ZIP contains a parent/child overwrite conflict' }
    }
  }
  if (-not $ValidateOnly) {
    if ([string]::IsNullOrEmpty($Destination)) { throw 'Extraction destination is required' }
    if ((Get-ChildItem -LiteralPath $Destination -Force | Measure-Object).Count -ne 0) { throw 'Extraction destination must be empty' }
    $root = [System.IO.Path]::GetFullPath($Destination).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
    [long]$written = 0
    foreach ($entry in $zip.Entries) {
      $name = $entry.FullName
      $isDirectory = $name.EndsWith('/')
      $relative = $name.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
      $target = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $relative))
      if (-not $target.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) { throw "ZIP path escaped the extraction directory: $name" }
      if ($isDirectory) {
        [System.IO.Directory]::CreateDirectory($target) | Out-Null
        continue
      }
      [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($target)) | Out-Null
      $input = $entry.Open()
      try {
        $output = [System.IO.FileStream]::new($target, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
        try { $input.CopyTo($output); $written += $output.Length }
        finally { $output.Dispose() }
      }
      finally { $input.Dispose() }
      if ($written -gt $MaxUnpackedBytes) { throw 'ZIP expands beyond the manifest size limit' }
    }
  }
}
finally { $zip.Dispose() }
